/**
 * Minimal Ace Data x402 probe for Kling video generation.
 *
 * The earlier alt-probe run against /kling/videos hit undici's
 * HeadersTimeoutError before any response arrived. Default undici
 * timeouts in Node's bundled fetch were firing before Kling's
 * synchronous render had time to complete and send headers back.
 *
 * Fix: install undici as an explicit dep, override the global
 * dispatcher with headersTimeout + bodyTimeout bumped to 5 minutes
 * each. Same probe shape as ace-x402-video-alt-probe.ts otherwise.
 *
 * Setup once:
 *   npm install undici
 *
 * Then run:
 *   tsx src/probes/ace-x402-kling-probe.ts
 *
 * IMPORTANT: unset ACE_API_TOKEN before running.
 */

import * as fs from 'node:fs';
import { Agent, setGlobalDispatcher } from 'undici';
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

// Bump fetch timeouts process-wide before any fetch call happens.
// Video generation is synchronous on /kling/videos and can take
// 60–180 seconds; the default headersTimeout was firing too early.
setGlobalDispatcher(
  new Agent({
    headersTimeout: 300_000, // 5 min — wait this long for response headers
    bodyTimeout: 300_000,    // 5 min — wait this long for body to finish streaming
    connectTimeout: 30_000,  // 30s for TCP/TLS connection
  }),
);

const KEYPAIR_PATH = process.env.SOLANA_KEYPAIR_PATH ?? './agent-keypair.json';
const RPC_URL = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const ACE_URL = 'https://api.acedata.cloud/kling/videos';

const REQUEST_BODY = {
  action: 'text2video',
  model: 'kling-v1',
  prompt: 'A short 6-second cinematic test clip: dark abstract motion, seamless loop, no text.',
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

function extractVideoUrl(body: string): string | null {
  try {
    const j = JSON.parse(body);
    return (
      j?.data?.[0]?.url ??
      j?.data?.url ??
      j?.url ??
      j?.video_url ??
      j?.output?.url ??
      j?.result?.url ??
      j?.video?.url ??
      null
    );
  } catch {
    return null;
  }
}

function extractTaskId(body: string): string | null {
  try {
    const j = JSON.parse(body);
    return j?.task_id ?? j?.id ?? j?.data?.task_id ?? null;
  } catch {
    return null;
  }
}

async function main() {
  if (process.env.ACE_API_TOKEN) {
    console.error('ACE_API_TOKEN is set. Unset it before running this probe.');
    process.exit(1);
  }

  const kp = loadKeypair(KEYPAIR_PATH);
  const connection = new Connection(RPC_URL, 'confirmed');

  console.log('=== Ace Data x402 Kling probe (long timeout) ===');
  console.log(`Agent wallet : ${kp.publicKey.toBase58()}`);
  console.log(`Endpoint     : ${ACE_URL}`);
  console.log(`Body         : ${JSON.stringify(REQUEST_BODY)}`);
  console.log(`Timeouts     : headers + body 300s each`);
  console.log();

  console.log('[1/3] Initial POST, expecting 402 Payment Required...');
  const initialRes = await fetch(ACE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(REQUEST_BODY),
  });
  const initialBody = await initialRes.text();
  console.log(`      HTTP ${initialRes.status}`);
  console.log(`      body: ${initialBody.slice(0, 800)}`);
  console.log();

  if (initialRes.status === 200) {
    console.log('Service returned 200 without payment. No x402 to settle.');
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
    console.log('No Solana option in accepts array.');
    return;
  }

  const decimals = requirement.extra?.decimals ?? 6;
  console.log('[2/3] Parsed payment requirement:');
  console.log(`      maxAmountRequired: ${requirement.maxAmountRequired} (${formatUsdc(requirement.maxAmountRequired, decimals)} USDC)`);
  console.log(`      payTo            : ${requirement.payTo}`);
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
    console.log('Source ATA does not exist.');
    return;
  }
  console.log(`      source ATA balance: ${formatUsdc(sourceBalance, decimals)} USDC`);
  if (sourceBalance < amount) {
    console.log(`      insufficient. Bailing.`);
    return;
  }
  console.log();

  console.log('[3/3] Settling and retrying with X-PAYMENT (long timeout)...');

  const tx = new Transaction();
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 80_000 }));

  const destInfo = await connection.getAccountInfo(destATA, 'confirmed');
  if (!destInfo) {
    tx.add(createAssociatedTokenAccountInstruction(kp.publicKey, destATA, payTo, mint));
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

  console.log('      Retrying with X-PAYMENT — will wait up to 5 minutes for Kling to render...');
  const retryStart = Date.now();
  const retryRes = await fetch(ACE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-PAYMENT': b64(envelope),
    },
    body: JSON.stringify(REQUEST_BODY),
  });
  const retryBody = await retryRes.text();
  const retryMs = Date.now() - retryStart;
  console.log(`      HTTP ${retryRes.status} (in ${(retryMs / 1000).toFixed(1)}s)`);
  console.log(`      body (truncated to 2000 chars): ${retryBody.slice(0, 2000)}`);
  console.log();

  if (retryRes.status === 200) {
    console.log('=== SUCCESS ===');
    console.log(`Kling x402 settlement on Solana mainnet.`);
    console.log(`Settlement tx : ${settlementSig}`);
    console.log(`Amount        : ${formatUsdc(amount, decimals)} USDC`);

    const videoUrl = extractVideoUrl(retryBody);
    const taskId = extractTaskId(retryBody);
    if (videoUrl) {
      console.log(`Video URL     : ${videoUrl}`);
    } else if (taskId) {
      console.log(`Task ID       : ${taskId}`);
      console.log(`Note: response carries a task_id, no immediate URL.`);
      console.log(`Poll GET /kling/tasks/${taskId} to fetch the video URL.`);
    } else {
      console.log(`(No URL or task_id auto-detected; full body above.)`);
    }
    return;
  }

  console.log('=== KLING WALL ===');
  console.log(`On-chain settlement landed: ${settlementSig}`);
  console.log(`Kling endpoint returned ${retryRes.status} after payment.`);
  console.log();
  if (retryBody.includes('default') && retryBody.includes('channel')) {
    console.log('Response mentions default/channel — likely same provisioning');
    console.log('issue as Hailuo. Add to the Doms message.');
  }
}

main().catch((err) => {
  console.error('Probe failed:', err);
  process.exit(1);
});
