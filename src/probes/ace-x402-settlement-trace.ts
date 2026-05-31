/**
 * Diagnostic v2: did Ace Data's facilitator ever submit a tx for our wallet?
 *
 * v2 adds 800ms sleep between getTransaction calls (public mainnet-beta RPC
 * hits per-method rate limits fast) and continue-on-error so partial results
 * still print if any individual fetch fails.
 *
 * If you have a private Helius/QuickNode RPC, set SOLANA_RPC_URL to it for
 * faster runs without rate-limit retries.
 *
 * Run:
 *   tsx src/probes/ace-x402-settlement-trace.ts
 */

import { Connection, PublicKey } from '@solana/web3.js';

const RPC_URL = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const PAYER_PUBKEY = 'FBykJfwmAyFK8mrqh1dgPAARFFCv1agUTGNfex6SDebj';
const FACILITATOR = '3SPm6qbgsDkj24MuR8Ss4sH97fziqyCiqFKDyeVU2igq';
const LOOKBACK_HOURS = 10;
const SLEEP_BETWEEN_FETCHES_MS = 800;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const connection = new Connection(RPC_URL, 'confirmed');
  const payer = new PublicKey(PAYER_PUBKEY);

  console.log('=== Settlement trace diagnostic v2 ===');
  console.log(`Wallet      : ${PAYER_PUBKEY}`);
  console.log(`Facilitator : ${FACILITATOR}`);
  console.log(`Lookback    : ${LOOKBACK_HOURS}h`);
  console.log(`RPC         : ${RPC_URL}`);
  console.log();

  console.log('Fetching signature list...');
  const sigs = await connection.getSignaturesForAddress(payer, { limit: 200 });
  console.log(`  Got ${sigs.length} total.`);
  const cutoff = Math.floor(Date.now() / 1000) - LOOKBACK_HOURS * 3600;
  const recent = sigs.filter((s) => s.blockTime && s.blockTime >= cutoff);
  console.log(`  ${recent.length} in last ${LOOKBACK_HOURS}h.`);
  console.log();

  if (recent.length === 0) {
    console.log('No signatures in window. Nothing to inspect.');
    return;
  }

  console.log('Per-signature inspection:');
  console.log();

  let facilitatorCount = 0;
  let facilitatorFailed = 0;
  let ownCount = 0;
  let unknownCount = 0;
  let fetchFailed = 0;

  for (let i = 0; i < recent.length; i++) {
    const s = recent[i];
    if (!s.blockTime) continue;
    const minsAgo = ((Date.now() / 1000 - s.blockTime) / 60).toFixed(1);
    const sigShort = s.signature.slice(0, 16);

    try {
      const tx = await connection.getTransaction(s.signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      if (!tx) {
        console.log(`  [${i + 1}] ${minsAgo}m ago | sig=${sigShort}... | (tx not found)`);
        fetchFailed++;
      } else {
        const feePayer = tx.transaction.message.staticAccountKeys[0].toBase58();
        const failed = !!s.err;
        let label = 'unknown-feePayer';
        if (feePayer === PAYER_PUBKEY) {
          label = 'OWN-SUBMITTED';
          ownCount++;
        } else if (feePayer === FACILITATOR) {
          label = failed ? 'FACILITATOR-FAILED' : 'FACILITATOR-CONFIRMED';
          facilitatorCount++;
          if (failed) facilitatorFailed++;
        } else {
          unknownCount++;
        }
        console.log(`  [${i + 1}] ${minsAgo}m ago | feePayer=${feePayer.slice(0, 8)}... | ${label}`);
        console.log(`        sig: ${s.signature}`);
        if (failed) {
          console.log(`        err: ${JSON.stringify(s.err)}`);
        }
      }
    } catch (e: any) {
      console.log(`  [${i + 1}] ${minsAgo}m ago | sig=${sigShort}... | fetch error: ${e.message}`);
      fetchFailed++;
    }

    if (i < recent.length - 1) {
      await sleep(SLEEP_BETWEEN_FETCHES_MS);
    }
  }

  console.log();
  console.log('=== Summary ===');
  console.log(`Own-submitted (we paid SOL fees)            : ${ownCount}`);
  console.log(`Facilitator-submitted (canonical, confirmed): ${facilitatorCount - facilitatorFailed}`);
  console.log(`Facilitator-submitted (canonical, failed)   : ${facilitatorFailed}`);
  console.log(`Unknown feePayer                            : ${unknownCount}`);
  console.log(`Fetch failed (rate-limited or missing)      : ${fetchFailed}`);
  console.log();

  console.log('=== Conclusion ===');
  if (facilitatorCount === 0 && fetchFailed === 0) {
    console.log('NO facilitator-submitted txs found.');
    console.log('→ Rules out scenario 2 (silent submission failure).');
    console.log('→ Either scenario 1 (batched/deferred) or scenario 3 (grace mode).');
    console.log('→ Re-run this probe every few hours over the next 24h to test scenario 1.');
  } else if (facilitatorCount === 0 && fetchFailed > 0) {
    console.log('NO facilitator-submitted txs found, but some fetches failed.');
    console.log('→ Result is partial. Re-run after a minute to retry rate-limited fetches.');
  } else if (facilitatorFailed > 0 && facilitatorFailed === facilitatorCount) {
    console.log('All facilitator-submitted txs FAILED on-chain.');
    console.log('→ Scenario 2 confirmed: silent submission failure.');
    console.log('→ Likely blockhash expired between our build and facilitator submit.');
    console.log('→ Report to Doms with the err details above.');
  } else if (facilitatorCount > 0 && facilitatorFailed === 0) {
    console.log('Facilitator-submitted txs CONFIRMED.');
    console.log('→ Settlements ARE on-chain. Update submission docs with these sigs.');
  } else {
    console.log('Mixed: some facilitator txs confirmed, some failed.');
    console.log('→ Both scenario 1 (settlements happening) AND scenario 2 (some failures).');
  }
}

main().catch((err) => {
  console.error('Trace failed:', err);
  process.exit(1);
});
