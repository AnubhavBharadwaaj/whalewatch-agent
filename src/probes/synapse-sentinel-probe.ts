/**
 * Synapse Sentinel x402 probe — calls one of Sentinel's 110 SAP tools
 * via x402 to satisfy the bounty requirement of using Sentinel at least once.
 *
 * Sentinel is an active SAP agent at:
 *   Wallet: Ccr2yK3hLALU4p8oNRqrh4dGuvPJTth5KCLMio8cE1ph
 *   PDA:    AzqhCKhku9TX3ScVtQw5nffLJ6PoA8r3P6HiTdinuAKz
 *   Tools:  https://agent.sentinel.oobeprotocol.ai/tools/:name
 *
 * We call the pyth:get-price tool (data:oracle capability) to fetch
 * a live SOL/USD price from the Pyth oracle. This is the cheapest
 * Sentinel call at 0.02 SPL/call.
 *
 * Run:
 *   ACE_API_TOKEN="" npx tsx src/probes/synapse-sentinel-probe.ts
 *
 * Requires USDC in the agent wallet for x402 settlement.
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
    headersTimeout: 60_000,
    bodyTimeout: 60_000,
    connectTimeout: 30_000,
  }),
);

const KEYPAIR_PATH = process.env.SOLANA_KEYPAIR_PATH ?? './agent-keypair.json';
const RPC_URL = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

// Sentinel tool endpoints
const SENTINEL_BASE = 'https://agent.sentinel.oobeprotocol.ai';
const TOOL_NAME = 'pyth-get-price';
const TOOL_URL = `${SENTINEL_BASE}/tools/${TOOL_NAME}`;

// Alternative tools to try if pyth-get-price doesn't work
const FALLBACK_TOOLS = [
  'get-sol-balance',
  'get-token-balance',
  'get-price',
];

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

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function tryTool(url: string, body: Record<string, unknown>, payer: Keypair, connection: Connection): Promise<boolean> {
  console.log(`\n[1/4] POST ${url} without auth → expect 402...`);
  const res1 = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const body1 = await res1.text();
  console.log(`      HTTP ${res1.status}`);
  console.log(`      body: ${body1.slice(0, 500)}`);

  if (res1.status !== 402) {
    if (res1.status === 200) {
      console.log('      Tool returned 200 without payment — might be free. Logging as success.');
      return true;
    }
    console.log(`      Expected 402, got ${res1.status}. Trying next tool...`);
    return false;
  }

  const parsed = JSON.parse(body1);
  const solReq = (parsed.accepts ?? []).find((a: any) => a.network === 'solana');
  if (!solReq) {
    console.log('      No Solana option in accepts. Trying next tool...');
    return false;
  }

  const decimals = solReq.extra?.decimals ?? 6;
  const amount = BigInt(solReq.maxAmountRequired);

  console.log(`[2/4] Payment requirement:`);
  console.log(`      amount  : ${solReq.maxAmountRequired} (${formatUsdc(amount, decimals)} USDC)`);
  console.log(`      payTo   : ${solReq.payTo}`);

  // Settle on-chain
  console.log(`[3/4] Settling on-chain (pre-submit)...`);
  const mint = new PublicKey(solReq.asset);
  const payTo = new PublicKey(solReq.payTo);
  const sourceATA = getAssociatedTokenAddressSync(mint, payer.publicKey);
  const destATA = getAssociatedTokenAddressSync(mint, payTo);

  let sourceBalance: bigint;
  try {
    const acct = await getAccount(connection, sourceATA);
    sourceBalance = acct.amount;
  } catch {
    console.log('      Source ATA does not exist. Need USDC in wallet.');
    return false;
  }
  console.log(`      source balance: ${formatUsdc(sourceBalance, decimals)} USDC`);
  if (sourceBalance < amount) {
    console.log('      Insufficient USDC. Top up wallet first.');
    return false;
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

  const sig = await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  });
  console.log(`      settled: ${sig}`);
  console.log(`      explorer: https://solscan.io/tx/${sig}`);

  // Retry with X-PAYMENT
  const envelope = {
    x402Version: 2,
    scheme: solReq.scheme ?? 'exact',
    network: 'solana',
    payload: { signature: sig },
  };

  console.log(`[4/4] Retry with X-PAYMENT header...`);
  const res2 = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-PAYMENT': b64(envelope),
    },
    body: JSON.stringify(body),
  });
  const body2 = await res2.text();
  console.log(`      HTTP ${res2.status}`);
  console.log(`      body: ${body2.slice(0, 1000)}`);

  console.log(`\n=== SENTINEL TOOL CALL COMPLETE ===`);
  console.log(`Tool     : ${url}`);
  console.log(`Settled  : ${sig}`);
  console.log(`Amount   : ${formatUsdc(amount, decimals)} USDC`);
  console.log(`Response : HTTP ${res2.status}`);
  return true;
}

async function main() {
  const payer = loadKeypair(KEYPAIR_PATH);
  const connection = new Connection(RPC_URL, 'confirmed');

  console.log('=== Synapse Sentinel x402 Probe ===');
  console.log(`Wallet   : ${payer.publicKey.toBase58()}`);
  console.log(`Sentinel : ${SENTINEL_BASE}`);
  console.log();

  // Try primary tool
  const primaryBody = {
    symbol: 'SOL',
    currency: 'USD',
  };

  let success = await tryTool(TOOL_URL, primaryBody, payer, connection);

  // Try fallbacks if primary fails
  if (!success) {
    for (const fallback of FALLBACK_TOOLS) {
      const fallbackUrl = `${SENTINEL_BASE}/tools/${fallback}`;
      const fallbackBody: Record<string, unknown> = fallback.includes('balance')
        ? { address: payer.publicKey.toBase58() }
        : { symbol: 'SOL' };
      console.log(`\n--- Trying fallback: ${fallback} ---`);
      success = await tryTool(fallbackUrl, fallbackBody, payer, connection);
      if (success) break;
    }
  }

  if (!success) {
    console.log('\n=== ALL TOOLS FAILED ===');
    console.log('Sentinel might be down or the tool names have changed.');
    console.log('Check https://explorer.oobeprotocol.ai for current tool names.');
  }
}

main().catch((err) => {
  console.error('Probe failed:', err);
  process.exit(1);
});
