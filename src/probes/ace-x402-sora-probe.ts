/**
 * Minimal Ace Data x402 probe for Sora video generation.
 *
 * The earlier alt-probe POSTed to /sora/tasks and got HTTP 200 with
 * an empty body — likely the wrong endpoint. Across other Ace Data
 * providers the pattern is /<provider>/videos to create + 
 * /<provider>/tasks/{id} to poll. This probe targets that pattern:
 *
 *   1. POST /sora/videos with prompt → expect 402
 *   2. Settle USDC on Solana
 *   3. Retry POST /sora/videos with X-PAYMENT → expect 200 with task_id
 *   4. Poll GET /sora/tasks/{task_id} every 5s until status is done
 *      or 5 min has elapsed
 *   5. Extract video URL from final task response
 *
 * Setup once (if not already done for Kling):
 *   npm install undici
 *
 * Run:
 *   tsx src/probes/ace-x402-sora-probe.ts
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

// Long timeouts for the retry call (in case Sora returns slowly) and
// for any polling GETs. Same pattern as the Kling probe.
setGlobalDispatcher(
  new Agent({
    headersTimeout: 300_000,
    bodyTimeout: 300_000,
    connectTimeout: 30_000,
  }),
);

const KEYPAIR_PATH = process.env.SOLANA_KEYPAIR_PATH ?? './agent-keypair.json';
const RPC_URL = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const ACE_URL = 'https://api.acedata.cloud/sora/videos';
const TASKS_BASE = 'https://api.acedata.cloud/sora/tasks';

// Minimal Sora body — start with just the prompt. If the 402/retry
// errors on missing fields, the response tells us what to add.
const REQUEST_BODY = {
  prompt: 'A short 6-second cinematic test clip: dark abstract motion, seamless loop, no text.',
};

const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_DURATION_MS = 300_000; // 5 minutes total polling budget

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

function extractTaskId(body: string): string | null {
  try {
    const j = JSON.parse(body);
    return j?.task_id ?? j?.id ?? j?.data?.task_id ?? j?.data?.id ?? null;
  } catch {
    return null;
  }
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

function extractStatus(body: string): string | null {
  try {
    const j = JSON.parse(body);
    return j?.status ?? j?.state ?? j?.data?.status ?? null;
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pollSoraTask(taskId: string): Promise<{ url: string | null; finalBody: string }> {
  console.log(`      Polling /sora/tasks/${taskId} every ${POLL_INTERVAL_MS / 1000}s...`);
  const pollStart = Date.now();
  let attempts = 0;
  while (Date.now() - pollStart < POLL_MAX_DURATION_MS) {
    attempts++;
    const res = await fetch(`${TASKS_BASE}/${taskId}`, { method: 'GET' });
    const body = await res.text();
    const elapsed = ((Date.now() - pollStart) / 1000).toFixed(1);
    const status = extractStatus(body);
    const url = extractVideoUrl(body);

    console.log(`      poll #${attempts} (t=${elapsed}s, HTTP ${res.status}): status=${status ?? '?'}${url ? `, url ready` : ''}`);

    if (url) return { url, finalBody: body };

    // Common "done" status strings — short-circuit if response is final but URL extraction failed.
    if (status && /^(failed|error|cancel|timeout)/i.test(status)) {
      console.log(`      task entered terminal failure state: ${status}`);
      return { url: null, finalBody: body };
    }
    if (status && /^(succeed|success|complete|done|finish)/i.test(status)) {
      console.log(`      task reports completion but URL not auto-extracted`);
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

  const kp = loadKeypair(KEYPAIR_PATH);
  const connection = new Connection(RPC_URL, 'confirmed');

  console.log('=== Ace Data x402 Sora probe (POST /sora/videos + poll /sora/tasks/{id}) ===');
  console.log(`Agent wallet : ${kp.publicKey.toBase58()}`);
  console.log(`Create URL   : ${ACE_URL}`);
  console.log(`Tasks URL    : ${TASKS_BASE}/{id}`);
  console.log(`Body         : ${JSON.stringify(REQUEST_BODY)}`);
  console.log();

  console.log('[1/4] Initial POST, expecting 402 Payment Required...');
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
    console.log('Got 200 instead of 402. Endpoint may not require payment, or');
    console.log('the response shape differs. Body above for inspection.');
    return;
  }
  if (initialRes.status === 404) {
    console.log('Got 404. /sora/videos may not be the right create endpoint —');
    console.log('try /sora/tasks instead, or check Ace Data Sora docs.');
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
    console.log('402 had no accepts array. Bailing.');
    return;
  }
  console.log(`      networks offered: ${accepts.map((a: any) => a.network).join(', ')}`);
  const requirement = accepts.find((a: any) => a.network === 'solana');
  if (!requirement) {
    console.log('No Solana option. Bailing.');
    return;
  }

  const decimals = requirement.extra?.decimals ?? 6;
  console.log('[2/4] Parsed payment requirement:');
  console.log(`      maxAmountRequired: ${requirement.maxAmountRequired} (${formatUsdc(requirement.maxAmountRequired, decimals)} USDC)`);
  console.log(`      payTo            : ${requirement.payTo}`);
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
    console.log('      insufficient. Bailing.');
    return;
  }
  console.log();

  console.log('[3/4] Settling and retrying with X-PAYMENT...');
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

  console.log('      Retrying POST with X-PAYMENT...');
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
  console.log(`      body (truncated to 1500 chars): ${retryBody.slice(0, 1500)}`);
  console.log();

  if (retryRes.status !== 200) {
    console.log('=== WALL ===');
    console.log(`Settlement landed: ${settlementSig}`);
    console.log(`Sora /videos returned ${retryRes.status} after payment.`);
    if (retryBody.includes('default') && retryBody.includes('channel')) {
      console.log('Response mentions default/channel — channel provisioning issue.');
    }
    return;
  }

  // 200 OK — try immediate URL, then fall through to polling.
  const immediateUrl = extractVideoUrl(retryBody);
  if (immediateUrl) {
    console.log('=== SUCCESS (synchronous) ===');
    console.log(`Settlement tx : ${settlementSig}`);
    console.log(`Amount        : ${formatUsdc(amount, decimals)} USDC`);
    console.log(`Video URL     : ${immediateUrl}`);
    return;
  }

  const taskId = extractTaskId(retryBody);
  if (!taskId) {
    console.log('=== INCONCLUSIVE ===');
    console.log(`Settlement: ${settlementSig}`);
    console.log(`Retry returned 200 but no URL and no task_id auto-detected.`);
    console.log(`Full body above. Either the response shape is different from`);
    console.log(`expectations or Sora needs additional fields in the body.`);
    return;
  }

  console.log(`[4/4] Got task_id ${taskId}. Polling for completion...`);
  const { url, finalBody } = await pollSoraTask(taskId);
  console.log();
  console.log(`      final body (truncated): ${finalBody.slice(0, 1500)}`);
  console.log();

  if (url) {
    console.log('=== SUCCESS (async + polled) ===');
    console.log(`Settlement tx : ${settlementSig}`);
    console.log(`Amount        : ${formatUsdc(amount, decimals)} USDC`);
    console.log(`Task ID       : ${taskId}`);
    console.log(`Video URL     : ${url}`);
    return;
  }

  console.log('=== POLLING DID NOT YIELD A URL ===');
  console.log(`Settlement landed: ${settlementSig}`);
  console.log(`Task ID: ${taskId}`);
  console.log('Either the task is still running past the 5-min budget, the task');
  console.log('failed, or the polling response shape needs different parsing.');
  console.log('Full final body above for inspection.');
}

main().catch((err) => {
  console.error('Probe failed:', err);
  process.exit(1);
});
