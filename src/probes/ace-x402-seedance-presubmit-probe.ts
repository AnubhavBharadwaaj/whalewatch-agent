/**
 * Ace Data x402 probe for Seedance — using the PRE-SUBMIT pattern that
 * settles per call on Solana mainnet (same pattern as our chat + image
 * probes that produced on-chain settlements).
 *
 * Context: the earlier Seedance probe used the canonical envelope (from
 * the X402Client repo) which returned a real video URL but did NOT
 * produce a facilitator-submitted on-chain settlement. The pre-submit
 * pattern is what `@acedatacloud/x402-client` package does internally
 * and what produces verifiable per-call settlements.
 *
 * If this probe lands a real on-chain settlement AND returns a working
 * Seedance video URL, then Seedance can be folded into the live cycle's
 * video stage and triple per-cycle settlement count for the load test
 * (currently 2 settlements/cycle → 3 settlements/cycle).
 *
 * Expected outcomes:
 *   - HTTP 200 with video URL + settlement landed on chain
 *     → Seedance works on pre-submit. Add to live cycle.
 *   - HTTP 5xx after settlement (like Luma, Hailuo, Pixverse)
 *     → Settlement landed but Seedance rendering doesn't accept the
 *       pre-submit envelope. ~$0.10 lesson, move on.
 *   - Hang / no response after settlement (like Kling, Sora)
 *     → Same as above but slower.
 *
 * Cost: ~$0.105 USDC if it settles (worth it for the answer).
 *
 * Run:
 *   tsx src/probes/ace-x402-seedance-presubmit-probe.ts
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

setGlobalDispatcher(
  new Agent({
    headersTimeout: 300_000,
    bodyTimeout: 300_000,
    connectTimeout: 30_000,
  }),
);

const KEYPAIR_PATH = process.env.SOLANA_KEYPAIR_PATH ?? './agent-keypair.json';
const RPC_URL = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const ACE_URL = 'https://api.acedata.cloud/seedance/videos';
const TASKS_BASE = 'https://api.acedata.cloud/seedance/tasks';

const REQUEST_BODY = {
  model: 'doubao-seedance-1-0-pro-250528',
  prompt: 'A short 6-second cinematic test clip: dark abstract motion, seamless loop, no text.',
};

const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_DURATION_MS = 300_000;

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
    return j?.data?.[0]?.video_url ?? j?.data?.[0]?.url ?? j?.data?.video_url ??
           j?.data?.url ?? j?.video_url ?? j?.url ??
           j?.output?.url ?? j?.result?.url ?? j?.video?.url ?? null;
  } catch { return null; }
}

function extractTaskId(body: string): string | null {
  try {
    const j = JSON.parse(body);
    return j?.task_id ?? j?.id ?? j?.data?.task_id ?? j?.data?.id ?? null;
  } catch { return null; }
}

function extractStatus(body: string): string | null {
  try {
    const j = JSON.parse(body);
    return j?.status ?? j?.state ?? j?.data?.status ?? null;
  } catch { return null; }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function pollTask(taskId: string): Promise<{ url: string | null; finalBody: string }> {
  console.log(`      Polling ${TASKS_BASE}/${taskId} every ${POLL_INTERVAL_MS / 1000}s...`);
  const start = Date.now();
  let attempts = 0;
  while (Date.now() - start < POLL_MAX_DURATION_MS) {
    attempts++;
    const res = await fetch(`${TASKS_BASE}/${taskId}`, { method: 'GET' });
    const body = await res.text();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
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

  console.log('=== Ace Data x402 Seedance probe (PRE-SUBMIT pattern) ===');
  console.log(`Payer wallet : ${payer.publicKey.toBase58()}`);
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
  console.log(`      body: ${body1.slice(0, 500)}`);
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
  console.log();

  // --- Step 3: settle ON-CHAIN ourselves (pre-submit pattern) ---
  console.log('[3/4] Settling on-chain (pre-submit — our wallet pays fees + USDC)...');

  const mint = new PublicKey(solReq.asset);
  const payTo = new PublicKey(solReq.payTo);
  const sourceATA = getAssociatedTokenAddressSync(mint, payer.publicKey);
  const destATA = getAssociatedTokenAddressSync(mint, payTo);

  let sourceBalance: bigint;
  try {
    const acct = await getAccount(connection, sourceATA);
    sourceBalance = acct.amount;
  } catch {
    console.log('Source ATA does not exist. Bailing.');
    return;
  }
  console.log(`      source ATA balance: ${formatUsdc(sourceBalance, decimals)} USDC`);
  if (sourceBalance < amount) {
    console.log('      insufficient. Bailing.');
    return;
  }

  const tx = new Transaction();
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 80_000 }));
  const destInfo = await connection.getAccountInfo(destATA, 'confirmed');
  if (!destInfo) {
    tx.add(createAssociatedTokenAccountInstruction(payer.publicKey, destATA, payTo, mint));
  }
  tx.add(
    new TransactionInstruction({
      programId: TOKEN_PROGRAM_ID,
      keys: [
        { pubkey: sourceATA, isSigner: false, isWritable: true },
        { pubkey: mint,       isSigner: false, isWritable: false },
        { pubkey: destATA,    isSigner: false, isWritable: true },
        { pubkey: payer.publicKey, isSigner: true, isWritable: false },
      ],
      data: buildTransferCheckedData(amount, decimals),
    }),
  );

  tx.feePayer = payer.publicKey;
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;

  const settlementSig = await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  });
  console.log(`      settled: ${settlementSig}`);
  console.log(`      explorer: https://solscan.io/tx/${settlementSig}`);
  console.log();

  // --- Step 4: retry with X-PAYMENT carrying the confirmed signature ---
  const envelope = {
    x402Version: 2,
    scheme: solReq.scheme ?? 'exact',
    network: 'solana',
    payload: { signature: settlementSig },
  };
  const xPayment = b64(envelope);

  console.log('[4/4] Retry POST with X-PAYMENT header (confirmed sig)...');
  const retryStart = Date.now();
  const res2 = await fetch(ACE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-PAYMENT': xPayment,
    },
    body: JSON.stringify(REQUEST_BODY),
  });
  const body2 = await res2.text();
  const retryMs = Date.now() - retryStart;
  console.log(`      HTTP ${res2.status} (in ${(retryMs / 1000).toFixed(1)}s)`);
  console.log(`      body (truncated to 1500 chars): ${body2.slice(0, 1500)}`);
  console.log();

  if (res2.status !== 200) {
    console.log('=== WALL (settlement landed but service errored) ===');
    console.log(`Settlement tx : ${settlementSig}  (~$${formatUsdc(amount, decimals)} USDC spent)`);
    console.log(`Seedance returned ${res2.status} after payment.`);
    console.log();
    console.log('Verdict: Seedance does NOT accept the pre-submit envelope cleanly.');
    console.log('Cannot fold Seedance into the live cycle for settlement amplification.');
    return;
  }

  const immediateUrl = extractVideoUrl(body2);
  if (immediateUrl) {
    console.log('=== SUCCESS (synchronous) ===');
    console.log(`Settlement tx : ${settlementSig}`);
    console.log(`Amount        : ${formatUsdc(amount, decimals)} USDC`);
    console.log(`Video URL     : ${immediateUrl}`);
    console.log();
    console.log('Verdict: Seedance WORKS on pre-submit pattern. Can be folded into');
    console.log('the live cycle video stage to triple per-cycle settlement count.');
    return;
  }

  const taskId = extractTaskId(body2);
  if (!taskId) {
    console.log('=== INCONCLUSIVE (200 but no URL/task_id) ===');
    console.log(`Settlement landed: ${settlementSig}`);
    return;
  }

  console.log(`Got task_id ${taskId}. Polling for completion...`);
  const { url, finalBody } = await pollTask(taskId);
  console.log();
  console.log(`      final body (truncated): ${finalBody.slice(0, 1500)}`);
  console.log();
  if (url) {
    console.log('=== SUCCESS (async + polled) ===');
    console.log(`Settlement tx : ${settlementSig}`);
    console.log(`Task ID       : ${taskId}`);
    console.log(`Video URL     : ${url}`);
    console.log();
    console.log('Verdict: Seedance WORKS on pre-submit (with polling).');
    return;
  }
  console.log('=== POLLING DID NOT YIELD A URL ===');
  console.log(`Settlement landed: ${settlementSig}`);
  console.log(`Task ID: ${taskId}`);
}

main().catch((err) => {
  console.error('Probe failed:', err);
  process.exit(1);
});
