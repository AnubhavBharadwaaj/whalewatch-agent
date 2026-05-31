/**
 * Ace Data x402 probe for Veo video generation — using the CANONICAL
 * envelope from Ace Data's reference X402Client repo
 * (github.com/AceDataCloud/X402Client/typescript/scripts/test-solana-e2e.ts).
 *
 * Differences from all earlier probes in this project — important:
 *   - feePayer is the facilitator (3SPm6...), not our wallet
 *   - we partial-sign and DO NOT submit on-chain ourselves
 *   - X-Payment carries `payload.serializedTransaction` (base64 of the
 *     partial-signed unsubmitted tx), not `payload.signature`
 *   - compute unit price 5000 μLamports/CU is set (max per spec)
 *   - ATA creation uses the idempotent variant
 *
 * Doms confirmed today that the recommended video providers on x402 are
 * Kling, Veo, and Seedance. Veo is the first untested one of the three.
 *
 * Setup:
 *   npm install undici  (one-time)
 *
 * Run:
 *   tsx src/probes/ace-x402-veo-probe.ts
 *
 * IMPORTANT: unset ACE_API_TOKEN before running.
 */

import * as fs from 'node:fs';
import { Agent, setGlobalDispatcher } from 'undici';
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
} from '@solana/spl-token';

setGlobalDispatcher(
  new Agent({
    headersTimeout: 300_000,
    bodyTimeout: 300_000,
    connectTimeout: 30_000,
  }),
);

const KEYPAIR_PATH = process.env.SOLANA_KEYPAIR_PATH ?? './agent-keypair.json';
const RPC_URL = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const ACE_URL = 'https://api.acedata.cloud/veo/videos';
const TASKS_BASE = 'https://api.acedata.cloud/veo/tasks';
const FACILITATOR_ADDRESS = '3SPm6qbgsDkj24MuR8Ss4sH97fziqyCiqFKDyeVU2igq';

const REQUEST_BODY = {
  model: 'veo3',
  prompt: 'A short 6-second cinematic test clip: dark abstract motion, seamless loop, no text.',
};

const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_DURATION_MS = 300_000;

function loadKeypair(path: string): Keypair {
  const raw = fs.readFileSync(path, 'utf8');
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
}

function formatUsdc(microUnits: bigint | string, decimals: number): string {
  const n = typeof microUnits === 'string' ? BigInt(microUnits) : microUnits;
  const divisor = BigInt(10 ** decimals);
  const whole = n / divisor;
  const frac = n % divisor;
  return `${whole}.${frac.toString().padStart(decimals, '0')}`;
}

function extractTaskId(body: string): string | null {
  try {
    const j = JSON.parse(body);
    return j?.task_id ?? j?.id ?? j?.data?.task_id ?? j?.data?.id ?? null;
  } catch { return null; }
}

function extractVideoUrl(body: string): string | null {
  try {
    const j = JSON.parse(body);
    return j?.data?.[0]?.video_url ??   // ← add this first, Ace Data uses this field
           j?.data?.[0]?.url ??
           j?.data?.url ??
           j?.url ??
           j?.video_url ??
           j?.output?.url ??
           j?.result?.url ??
           j?.video?.url ??
           null;
  } catch { return null; }
}

function extractStatus(body: string): string | null {
  try {
    const j = JSON.parse(body);
    return j?.status ?? j?.state ?? j?.data?.status ?? null;
  } catch { return null; }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pollTask(taskId: string): Promise<{ url: string | null; finalBody: string }> {
  console.log(`      Polling ${TASKS_BASE}/${taskId} every ${POLL_INTERVAL_MS / 1000}s...`);
  const pollStart = Date.now();
  let attempts = 0;
  while (Date.now() - pollStart < POLL_MAX_DURATION_MS) {
    attempts++;
    const res = await fetch(`${TASKS_BASE}/${taskId}`, { method: 'GET' });
    const body = await res.text();
    const elapsed = ((Date.now() - pollStart) / 1000).toFixed(1);
    const status = extractStatus(body);
    const url = extractVideoUrl(body);
    console.log(`      poll #${attempts} (t=${elapsed}s, HTTP ${res.status}): status=${status ?? '?'}${url ? ', url ready' : ''}`);
    if (url) return { url, finalBody: body };
    if (status && /^(failed|error|cancel|timeout)/i.test(status)) {
      return { url: null, finalBody: body };
    }
    if (status && /^(succeed|success|complete|done|finish)/i.test(status)) {
      return { url: null, finalBody: body };
    }
    await sleep(POLL_INTERVAL_MS);
  }
  return { url: null, finalBody: 'polling window exhausted' };
}

async function main() {
  if (process.env.ACE_API_TOKEN) {
    console.error('ACE_API_TOKEN is set. Unset it before running this probe.');
    process.exit(1);
  }

  const payer = loadKeypair(KEYPAIR_PATH);
  const connection = new Connection(RPC_URL, 'confirmed');

  console.log('=== Ace Data x402 Veo probe (canonical envelope) ===');
  console.log(`Payer wallet : ${payer.publicKey.toBase58()}`);
  console.log(`Facilitator  : ${FACILITATOR_ADDRESS}`);
  console.log(`Create URL   : ${ACE_URL}`);
  console.log(`Body         : ${JSON.stringify(REQUEST_BODY)}`);
  console.log();

  // --- Step 1: unauthenticated POST → expect 402 ---
  console.log('[1/4] POST without auth → expect 402...');
  const res1 = await fetch(ACE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(REQUEST_BODY),
  });
  const body1 = await res1.text();
  console.log(`      HTTP ${res1.status}`);
  console.log(`      body: ${body1.slice(0, 600)}`);
  console.log();
  if (res1.status !== 402) {
    console.log(`Expected 402, got ${res1.status}. Cannot proceed.`);
    return;
  }
  const parsed = JSON.parse(body1);
  const solReq = (parsed.accepts ?? []).find((a: any) => a.network === 'solana');
  if (!solReq) {
    console.log('No Solana option in accepts array.');
    return;
  }
  const decimals = solReq.extra?.decimals ?? 6;
  const amount = BigInt(solReq.maxAmountRequired);
  console.log('[2/4] Payment requirement:');
  console.log(`      amount  : ${solReq.maxAmountRequired} (${formatUsdc(amount, decimals)} USDC)`);
  console.log(`      payTo   : ${solReq.payTo}`);
  console.log(`      asset   : ${solReq.asset}`);
  console.log();

  // --- Step 3: build CANONICAL partial-signed transaction ---
  console.log('[3/4] Build partial-signed tx (facilitator as feePayer)...');
  const facilitatorPubkey = new PublicKey(FACILITATOR_ADDRESS);
  const payToPubkey = new PublicKey(solReq.payTo);
  const usdcMint = new PublicKey(solReq.asset);
  const payerAta = await getAssociatedTokenAddress(usdcMint, payer.publicKey);
  const payToAta = await getAssociatedTokenAddress(usdcMint, payToPubkey);

  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  console.log(`      blockhash: ${blockhash.slice(0, 16)}...`);

  const instructions = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5000 }),
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey, // payer creates ATA — facilitator must NOT be in instruction accounts
      payToAta,
      payToPubkey,
      usdcMint,
    ),
    createTransferCheckedInstruction(
      payerAta,
      usdcMint,
      payToAta,
      payer.publicKey, // authority
      amount,
      decimals,
    ),
  ];

  const messageV0 = new TransactionMessage({
    payerKey: facilitatorPubkey, // facilitator pays gas — this is the key change
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  const transaction = new VersionedTransaction(messageV0);
  transaction.sign([payer]); // partial-sign only — facilitator signs as feePayer at submit time
  const serializedTx = Buffer.from(transaction.serialize()).toString('base64');
  console.log(`      serialized tx: ${serializedTx.length} chars`);
  console.log();

  // --- Step 4: build canonical X-Payment envelope and retry ---
  const envelope = {
    x402Version: 2,
    scheme: 'exact',
    network: 'solana',
    payload: { serializedTransaction: serializedTx },
  };
  const xPayment = Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64');

  console.log('[4/4] Retry POST with X-Payment header (facilitator will submit)...');
  const retryStart = Date.now();
  const res2 = await fetch(ACE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Payment': xPayment, // canonical title case
    },
    body: JSON.stringify(REQUEST_BODY),
  });
  const body2 = await res2.text();
  const retryMs = Date.now() - retryStart;
  console.log(`      HTTP ${res2.status} (in ${(retryMs / 1000).toFixed(1)}s)`);
  console.log(`      body (truncated to 1500 chars): ${body2.slice(0, 1500)}`);
  // X-Payment-Response header sometimes carries settlement metadata
  const xpr = res2.headers.get('x-payment-response');
  if (xpr) console.log(`      x-payment-response header: ${xpr}`);
  console.log();

  if (res2.status !== 200) {
    console.log('=== NON-200 ===');
    console.log(`Veo /videos returned ${res2.status}.`);
    if (body2.includes('default') && body2.includes('channel')) {
      console.log('Response mentions default/channel — possible provisioning issue.');
    }
    return;
  }

  // 200 — try immediate URL, then poll if task_id only
  const immediateUrl = extractVideoUrl(body2);
  if (immediateUrl) {
    console.log('=== SUCCESS (synchronous) ===');
    console.log(`Video URL: ${immediateUrl}`);
    console.log('Settlement tx submitted by facilitator — check x-payment-response');
    console.log('header above or query the agent wallet on Solscan for the latest');
    console.log('outgoing USDC transfer to find the settlement signature.');
    return;
  }

  const taskId = extractTaskId(body2);
  if (!taskId) {
    console.log('=== INCONCLUSIVE (200 but no URL/task_id) ===');
    console.log('Full body above for inspection.');
    return;
  }

  console.log(`Got task_id ${taskId}. Polling for completion...`);
  const { url, finalBody } = await pollTask(taskId);
  console.log();
  console.log(`      final body (truncated): ${finalBody.slice(0, 1500)}`);
  console.log();
  if (url) {
    console.log('=== SUCCESS (async + polled) ===');
    console.log(`Task ID  : ${taskId}`);
    console.log(`Video URL: ${url}`);
    console.log();
    console.log('Three Ace Data stage categories now proven on x402: chat, image, video.');
    return;
  }
  console.log('=== POLLING DID NOT YIELD A URL ===');
  console.log(`Task ID: ${taskId}`);
}

main().catch((err) => {
  console.error('Probe failed:', err);
  process.exit(1);
});
