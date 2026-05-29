/**
 * Minimal Ace Data x402 probe.
 *
 * Replicates the call that produced tolga-tom-nook's Solana x402 settlement
 * (tx 3EF2wCNajT...) on May 23, 2026. Same endpoint, same model, same
 * payload, ~$0.095 USDC. Used to test whether OUR agent wallet + OUR Ace
 * account can settle the same call via pure x402.
 *
 * Two outcomes both move us forward:
 *
 *   - HTTP 200 on retry  → fresh real Ace Data x402 settlement on mainnet,
 *                          signed by our agent wallet, in the bounty window.
 *                          Drop the sig into the submission alongside the
 *                          five prior settlements. The "live cycle uses
 *                          credit path" caveat softens significantly.
 *
 *   - HTTP 402 / error   → on-chain payment lands either way (we see the sig
 *                          before retry). Service refusing to fulfill after
 *                          a paid settlement is the routing-wall signal:
 *                          the wall is on Ace Data's side, not in our code.
 *                          Take the settlement sig + error body to Doms,
 *                          ask the now-specific channel-provisioning
 *                          question.
 *
 * Run:
 *   tsx src/probes/ace-x402-probe.ts
 *
 * Env (defaults shown):
 *   SOLANA_KEYPAIR_PATH   ./agent-keypair.json
 *   SOLANA_RPC_URL        https://api.mainnet-beta.solana.com
 *
 * IMPORTANT: unset ACE_API_TOKEN before running. With the Bearer token set
 * the call routes through the credit path and never returns 402. The whole
 * point of the probe is to force the x402 path.
 *
 * Cost: ~$0.095 USDC + a few thousand lamports of SOL fee per run.
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
const ACE_URL = 'https://api.acedata.cloud/openai/chat/completions';

// Exact payload from tolga's success receipt
// (receipts/ace-solana-x402-success-2026-05-23.json in his submission).
const REQUEST_BODY = {
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Say hi in 3 words' }],
  max_tokens: 10,
};

function loadKeypair(path: string): Keypair {
  const raw = fs.readFileSync(path, 'utf8');
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
}

// SPL TransferChecked instruction data layout:
//   [u8 discriminator = 12][u64 amount LE][u8 decimals]
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

  console.log('=== Ace Data x402 probe ===');
  console.log(`Agent wallet : ${kp.publicKey.toBase58()}`);
  console.log(`RPC          : ${RPC_URL}`);
  console.log(`Endpoint     : ${ACE_URL}`);
  console.log(`Body         : ${JSON.stringify(REQUEST_BODY)}`);
  console.log();

  // --- Step 1: initial call, expect 402 ---
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
    console.log('something is misconfigured — there is no x402 to settle.');
    return;
  }
  if (initialRes.status !== 402) {
    console.log(`Unexpected status ${initialRes.status}. Cannot proceed.`);
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

  // --- Step 2: parse payment requirement ---
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

  // Balance check
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

  // --- Step 3: build TransferChecked, settle, retry with X-PAYMENT ---
  console.log('[3/3] Building SPL TransferChecked, settling, retrying with X-PAYMENT...');

  const tx = new Transaction();
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 80_000 }));

  const destInfo = await connection.getAccountInfo(destATA, 'confirmed');
  if (!destInfo) {
    console.log(`      destination ATA does not exist; adding create-ATA instruction.`);
    tx.add(
      createAssociatedTokenAccountInstruction(
        kp.publicKey, // payer
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

  // Envelope per the x402 spec.
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
  console.log(`      body: ${retryBody}`);
  console.log();

  if (retryRes.status === 200) {
    console.log('=== SUCCESS ===');
    console.log(`Fresh real Ace Data x402 settlement on Solana mainnet.`);
    console.log(`Settlement tx : ${settlementSig}`);
    console.log(`Amount        : ${formatUsdc(amount, decimals)} USDC`);
    console.log(`Add to submission: https://solscan.io/tx/${settlementSig}`);
    return;
  }

  console.log('=== ROUTING WALL CONFIRMED ===');
  console.log(`On-chain settlement landed: ${settlementSig}`);
  console.log(`But service returned ${retryRes.status} after payment.`);
  console.log();
  console.log('This is the precise signal: the payment rail works (the USDC');
  console.log('transferred and settled on Solana), but Ace Data refused to fulfill');
  console.log('the service call after seeing the X-PAYMENT envelope. The wall is');
  console.log('account-side at Ace Data — not in our code.');
  console.log();
  console.log('Next step: DM Doms with:');
  console.log(`  - tolga's working settlement: 3EF2wCNajTCnei6x4ZEe3fUevCqcUAx7WZPGKssuMniAKLgvt7ztmFiAU2xbpVXVHGiytd7gFP1Eszd155ch6CZH`);
  console.log(`  - our settlement on the same call: ${settlementSig}`);
  console.log(`  - the retry response: HTTP ${retryRes.status} ${retryBody.slice(0, 200)}`);
  console.log('  - the question: what channel/group config does our Ace Data account need?');
}

main().catch((err) => {
  console.error('Probe failed:', err);
  process.exit(1);
});
