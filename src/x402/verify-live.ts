/**
 * x402 live verification — a single, watched, real-USDC settlement.
 *
 * This is the one part of the live path that cannot be proven without spending
 * real money: the actual x402 payment. It is deliberately a separate tool, not
 * part of the agent, and it performs exactly ONE paid call.
 *
 *   npm run verify:x402            Preview only. No USDC moves. Verifies the
 *                                  wallet, the Solana RPC, endpoint
 *                                  reachability, and the price.
 *   npm run verify:x402 -- --pay   Settles ONE real payment to the cheapest
 *                                  Ace Data endpoint (the Flux image submit,
 *                                  ~$0.015), prints the Solana settlement
 *                                  signature, and shows the USDC balance move.
 *
 * Run the preview first. Only run --pay once the preview is clean.
 */
import { PublicKey, type Connection } from '@solana/web3.js';
import { config } from '../config.js';
import { log } from '../util/log.js';
import { ACE_PATHS, aceUrl } from '../acedata/endpoints.js';
import { loadWallet } from '../solana/wallet.js';
import { X402Client } from './client.js';
import type { X402Result } from './types.js';

/** USDC mint on Solana mainnet. */
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** SOL balance in whole SOL, or null if it could not be read. */
async function solBalance(connection: Connection, owner: PublicKey): Promise<number | null> {
  try {
    return (await connection.getBalance(owner)) / 1e9;
  } catch (err) {
    log.warn(`Could not read SOL balance: ${String(err)}`);
    return null;
  }
}

/** USDC balance in whole USDC, or null if it could not be read. */
async function usdcBalance(connection: Connection, owner: PublicKey): Promise<number | null> {
  try {
    const res = await connection.getParsedTokenAccountsByOwner(owner, { mint: USDC_MINT });
    let total = 0;
    for (const acc of res.value) {
      const data = acc.account.data as unknown as {
        parsed?: { info?: { tokenAmount?: { uiAmount?: number | null } } };
      };
      const ui = data.parsed?.info?.tokenAmount?.uiAmount;
      if (typeof ui === 'number') total += ui;
    }
    return total;
  } catch (err) {
    log.warn(`Could not read USDC balance: ${String(err)}`);
    return null;
  }
}

function fmt(n: number | null, unit: string): string {
  return n === null ? `(unavailable) ${unit}` : `${n} ${unit}`;
}

async function main(): Promise<void> {
  const pay = process.argv.includes('--pay');
  // --model <name> overrides the image model for this run, so different models
  // can be tried without editing .env. Falls back to config (ACE_IMAGE_MODEL).
  const modelFlag = process.argv.indexOf('--model');
  const model =
    modelFlag >= 0 && modelFlag + 1 < process.argv.length
      ? process.argv[modelFlag + 1]!
      : config.aceImageModel;

  log.info('=== x402 live verification ===');
  log.info(
    pay
      ? 'PAY MODE — this will settle ONE real USDC payment on Solana mainnet.'
      : 'PREVIEW MODE — no USDC will move. (Add --pay to settle one real payment.)',
  );
  log.info(`Image model: ${model}`);
  log.info(
    config.aceApiToken
      ? 'Auth: ACE_API_TOKEN set — request is attributed to your Ace Data account.'
      : 'Auth: no ACE_API_TOKEN — request runs as group "default" (no model channels).',
  );

  // 1. Wallet.
  const wallet = loadWallet(config.agentKeypairPath, config.solanaRpcUrl);
  const owner = new PublicKey(wallet.address);
  log.info(`Agent wallet: ${wallet.address}`);

  // 2. Balances before.
  const solBefore = await solBalance(wallet.connection, owner);
  const usdcBefore = await usdcBalance(wallet.connection, owner);
  log.info(`Balance before — SOL: ${fmt(solBefore, 'SOL')}, USDC: ${fmt(usdcBefore, 'USDC')}`);

  // 3. The verification call — the cheapest paid endpoint (Flux image submit).
  const url = aceUrl(config.aceDataBaseUrl, ACE_PATHS.fluxImages);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.aceApiToken) headers.Authorization = `Bearer ${config.aceApiToken}`;
  const init: RequestInit = {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'generate',
      model,
      prompt: 'minimalist abstract test image, a single calm blue circle on a dark background',
      size: '1024x1024',
    }),
  };
  const client = new X402Client({ mode: 'live', wallet: wallet.adapter });

  // 4. Preview the price — hits the endpoint UNPAID.
  log.info(`Pricing ${url} ...`);
  const preview = await client.previewPrice(url, init);
  if (!preview) {
    // No 402 came back. Probe the endpoint directly to see what it returned.
    log.info('No 402 returned — probing the endpoint directly to see the result...');
    try {
      const probe = await fetch(url, init);
      const body = await probe.text();
      log.info(`Endpoint responded: HTTP ${probe.status} ${probe.statusText}`);
      log.info(`Response body: ${(body || '(empty)').slice(0, 800)}`);
      if (probe.ok) {
        log.info('---');
        log.info(
          'SUCCESS: the call was accepted (HTTP 2xx). With ACE_API_TOKEN set, AceData billed ' +
            'your account credits directly; the x402 gateway was not used. The agent can now ' +
            'reach Ace Data and get a result.',
        );
        return;
      }
      log.error('The endpoint returned an error (body above) — the call did not succeed.');
    } catch (err) {
      log.error('Diagnostic probe failed.', err);
    }
    process.exit(1);
  }
  const sol = (preview.accepts ?? []).find((a) => a.network === 'solana');
  if (!sol) {
    const nets = (preview.accepts ?? []).map((a) => a.network).join(', ') || '<none>';
    log.error(`The 402 offered no Solana payment option. Networks offered: ${nets}.`);
    process.exit(1);
  }
  const usd = Number(sol.maxAmountRequired) / 1e6;
  log.info(`Price: ${sol.maxAmountRequired} atomic USDC  (~$${usd.toFixed(6)})  ->  ${sol.payTo}`);

  // 5. Preview mode stops here.
  if (!pay) {
    log.info('---');
    log.info('Preview complete. Wallet, RPC, endpoint, and pricing all responded correctly.');
    log.info('No USDC moved. To settle one real payment, run:  npm run verify:x402 -- --pay');
    return;
  }

  // 6. Pay mode — one real settlement, after a short abort window.
  log.warn(`About to settle ~$${usd.toFixed(6)} of real USDC. Press Ctrl+C now to abort.`);
  for (let i = 5; i >= 1; i--) {
    log.warn(`Settling in ${i}...`);
    await sleep(1000);
  }

  let result: X402Result;
  try {
    result = await client.request(url, init);
  } catch (err) {
    log.error('The x402 request threw before completing.', err);
    log.error('If no "x402 settled on Solana" line appeared above, no USDC moved.');
    process.exit(1);
  }

  // 7. Report.
  const usdcAfter = await usdcBalance(wallet.connection, owner);
  const p = result.payment;
  log.info('---');
  if (p?.settled && p.signature) {
    log.info(`Settlement signature: ${p.signature}`);
    log.info(`Verify on-chain:      https://solscan.io/tx/${p.signature}`);
  } else {
    log.error('No settlement signature was produced — the payment did not settle.');
  }
  log.info(`Paid retry status:    ${result.status} (${result.ok ? 'ok' : 'not ok'})`);
  if (!result.ok) {
    const bodyText =
      typeof result.body === 'string' ? result.body : JSON.stringify(result.body);
    log.error(`Response body: ${(bodyText ?? '(empty)').slice(0, 600)}`);
  }
  if (usdcBefore !== null && usdcAfter !== null) {
    log.info(
      `USDC balance: ${usdcBefore} -> ${usdcAfter}  (delta ${(usdcAfter - usdcBefore).toFixed(6)})`,
    );
  }

  log.info('---');
  if (p?.settled && result.ok) {
    log.info('VERIFIED: the x402 payment settled and the paid call succeeded. The live path works.');
  } else if (p?.settled && !result.ok) {
    log.error(
      `PARTIAL: USDC settled (signature above) but the paid retry returned status ${result.status}. ` +
        'The payment path works; the endpoint call did not. Inspect the response before going live.',
    );
    process.exit(1);
  } else {
    log.error('FAILED: no settlement occurred. Do not run the agent in live mode until this is resolved.');
    process.exit(1);
  }
}

main().catch((err) => {
  log.error('x402 verification crashed.', err);
  process.exit(1);
});
