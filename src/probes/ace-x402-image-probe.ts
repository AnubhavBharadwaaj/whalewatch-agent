/**
 * Minimal Ace Data x402 probe for the image-generation endpoint.
 *
 * Same shape as src/probes/ace-x402-probe.ts (the chat probe), different
 * endpoint and request body. Tests whether DALL-E via
 * /openai/images/generations accepts the same Solana x402 path that
 * gpt-4o-mini does on /openai/chat/completions.
 *
 * Two outcomes both move us forward:
 *
 *   - HTTP 200 with image URL → image stage flippable to x402 in the
 *                               live cycle. Combined with the chat probe
 *                               result, two of the three Ace Data stages
 *                               are then proven on x402; only Luma left.
 *
 *   - HTTP 4xx/5xx after settlement → settlement still lands on-chain,
 *                                     proves the endpoint either rejects
 *                                     this account, this model, or this
 *                                     payload shape. Send the settlement
 *                                     sig + error body to Doms/Alex for
 *                                     a specific answer.
 *
 * Run:
 *   tsx src/probes/ace-x402-image-probe.ts
 *
 * Env (defaults shown):
 *   SOLANA_KEYPAIR_PATH   ./agent-keypair.json
 *   SOLANA_RPC_URL        https://api.mainnet-beta.solana.com
 *
 * IMPORTANT: unset ACE_API_TOKEN before running. With the Bearer token
 * set the call routes through credit path and never returns 402.
 *
 * Cost: whatever the 402 quotes for dall-e-3 generation (typically a
 * few cents) + a few thousand lamports of SOL fee.
 */

import * as fs from 'node:fs';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token';

const KEYPAIR_PATH = process.env.SOLANA_KEYPAIR_PATH ?? './agent-keypair.json';
const RPC_URL = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const ACE_URL = 'https://api.acedata.cloud/openai/images/generations';

const REQUEST_BODY = {
  model: 'dall-e-3',
  prompt: 'A minimalist test image: a single blue circle on a white background.',
  size: '1024x1024',
  n: 1,
};

function loadKeypair(path: string): Keypair {
  const raw = fs.readFileSync(path, 'utf8');
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
}

function buildTransferCheckedData(amount: bigint, decimals: number): Buffer {
  const buf = Buffer.alloc(10);
  buf.writeUInt8(12, 0);
  buf.writeBigUInt64LE(amount, 1);
  buf.writeUInt8(decimals, 9);
  return buf;
}

function b64(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64');
}

function formatUsdc(microUnits: bigint | string, decimals: number): string {
  const n = typeof microUnits === 'string' ? BigInt(microUnits) : microUnits;
  const divisor = BigInt(10 ** decimals);
  const whole = n / divisor;
  const frac = n % divisor;
  return `${whole}.${frac.toString().padStart(decimals, '0')}`;
}

async function main() {
  if (process.env.ACE_API_TOKEN) {
    console.error('ACE_API_TOKEN is set. Unset it before running this probe —');
    console.error('with the token, the call routes through credit path, not x402.');
    process.exit(1);
  }

  const kp = loadKeypair(KEYPAIR_PATH);
  const connection = new Connection(RPC_URL, 'confirmed');

  console.log('=== Ace Data x402 image probe ===');
  console.log(`Agent wallet : ${kp.publicKey.toBase58()}`);
  console.log(`RPC          : ${RPC_URL}`);
  console.log(`Endpoint     : ${ACE_URL}`);
  console.log(`Body         : ${JSON.stringify(REQUEST_BODY)}`);
  console.log();

  console.log('[1/3] Initial POST, expecting 402 Payment Required...');
  const initialRes = await fetch(ACE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(REQUEST_BODY),
  });
  const initialBody = await initialRes.text();
  console.log(`      HTTP ${initialRes.status}`);
  console.log(`      body: ${initialBody}`);
  console.log();

  if (initialRes.status === 200) {
    console.log('Service returned 200 without payment. Either free tier or');
    console.log('a misconfiguration — there is no x402 to settle.');
    return;
  }
  if (initialRes.status !== 402) {
    console.log(`Unexpected status ${initialRes.status}. Cannot proceed.`);
    console.log('If the endpoint URL is wrong, edit ACE_URL at the top of this file.');
    return;
  }

  let parsed: any;
  try {
    parsed = JSON.parse(initialBody);
  } catch {
    console.log('402 body is not JSON. Bailing.');
    return;
  }
  const accepts = parsed.accepts ?? [];
  if (accepts.length === 0) {
    console.log('402 response had no `accepts` array. Bailing.');
    return;
  }
  console.log(`      networks offered: ${accepts.map((a: any) => a.network).join(', ')}`);
  const requirement = accepts.find((a: any) => a.network === 'solana');
  if (!requirement) {
    console.log('No Solana option in accepts array. This probe is solana-only.');
    return;
  }

  const decimals = requirement.extra?.decimals ?? 6;
  console.log('[2/3] Parsed payment requirement:');
  console.log(`      network          : ${requirement.network}`);
  console.log(`      scheme           : ${requirement.scheme}`);
  console.log(`      maxAmountRequired: ${requirement.maxAmountRequired} (${formatUsdc(requirement.maxAmountRequired, decimals)} USDC)`);
  console.log(`      payTo            : ${requirement.payTo}`);
  console.log(`      asset (mint)     : ${requirement.asset}`);
  console.log(`      decimals         : ${decimals}`);
  console.log(`      resource         : ${requirement.resource ?? '(none)'}`);
  console.log();

  const mint = new PublicKey(requirement.asset);
  const payTo = new PublicKey(requirement.payTo);
  const amount = BigInt(requirement.maxAmountRequired);
  const sourceATA = getAssociatedTokenAddressSync(mint, kp.publicKey);
  const destATA = getAssociatedTokenAddressSync(mint, payTo);

  let sourceBalance: bigint;
  try {
    const acct = await getAccount(connection, sourceATA);
    sourceBalance = acct.amount;
  } catch {
    console.log(`Source ATA ${sourceATA.toBase58()} does not exist.`);
    console.log('Agent wallet has no USDC. Fund it before running the probe.');
    return;
  }
  console.log(`      source ATA balance: ${formatUsdc(sourceBalance, decimals)} USDC`);
  if (sourceBalance < amount) {
    console.log(`      insufficient — need ${formatUsdc(amount, decimals)} USDC. Bailing.`);
    return;
  }
  console.log();

  console.log('[3/3] Building SPL TransferChecked, settling, retrying with X-PAYMENT...');

  const tx = new Transaction();
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 80_000 }));

  const destInfo = await connection.getAccountInfo(destATA, 'confirmed');
  if (!destInfo) {
    console.log(`      destination ATA does not exist; adding create-ATA instruction.`);
    tx.add(
      createAssociatedTokenAccountInstruction(
        kp.publicKey,
        destATA,
        payTo,
        mint,
      ),
    );
  }

  tx.add(
    new TransactionInstruction({
      programId: TOKEN_PROGRAM_ID,
      keys: [
        { pubkey: sourceATA,   isSigner: false, isWritable: true  },
        { pubkey: mint,        isSigner: false, isWritable: false },
        { pubkey: destATA,     isSigner: false, isWritable: true  },
        { pubkey: kp.publicKey, isSigner: true,  isWritable: false },
      ],
      data: buildTransferCheckedData(amount, decimals),
    }),
  );

  tx.feePayer = kp.publicKey;
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;

  const settlementSig = await sendAndConfirmTransaction(connection, tx, [kp], {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  });
  console.log(`      settled: ${settlementSig}`);
  console.log(`      explorer: https://solscan.io/tx/${settlementSig}`);
  console.log();

  const envelope = {
    x402Version: 2,
    scheme: requirement.scheme ?? 'exact',
    network: 'solana',
    payload: { signature: settlementSig },
  };
  const xPayment = b64(envelope);

  console.log('      Retrying request with X-PAYMENT header...');
  const retryRes = await fetch(ACE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-PAYMENT': xPayment,
    },
    body: JSON.stringify(REQUEST_BODY),
  });
  const retryBody = await retryRes.text();
  console.log(`      HTTP ${retryRes.status}`);
  console.log(`      body (truncated to 1500 chars): ${retryBody.slice(0, 1500)}`);
  console.log();

  if (retryRes.status === 200) {
    console.log('=== SUCCESS ===');
    console.log(`Fresh real Ace Data DALL-E x402 settlement on Solana mainnet.`);
    console.log(`Settlement tx : ${settlementSig}`);
    console.log(`Amount        : ${formatUsdc(amount, decimals)} USDC`);
    console.log(`Explorer      : https://solscan.io/tx/${settlementSig}`);

    // Try to extract the image URL from the response.
    try {
      const respJson = JSON.parse(retryBody);
      const imageUrl = respJson?.data?.[0]?.url;
      if (imageUrl) {
        console.log(`Image URL     : ${imageUrl}`);
      }
    } catch {
      // response wasn't JSON; full body already printed above
    }
    return;
  }

  console.log('=== IMAGE ENDPOINT WALL ===');
  console.log(`On-chain settlement landed: ${settlementSig}`);
  console.log(`But the image endpoint returned ${retryRes.status} after payment.`);
  console.log();
  console.log('Payment rail works. Service-side fulfillment for this endpoint');
  console.log('is the question. Send the settlement sig + retry response body');
  console.log('to Doms/Alex for a specific answer about the images endpoint.');
}

main().catch((err) => {
  console.error('Probe failed:', err);
  process.exit(1);
});
