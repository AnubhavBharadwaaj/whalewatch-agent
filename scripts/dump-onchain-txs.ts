#!/usr/bin/env node
/**
 * Fetches all USDC transaction signatures for the agent wallet
 * from Solana mainnet and outputs a markdown file.
 *
 * Usage:
 *   npx tsx scripts/dump-onchain-txs.ts > onchain_usdc_transactions.md
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

const WALLET = 'FBykJfwmAyFK8mrqh1dgPAARFFCv1agUTGNfex6SDebj';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const SOLSCAN = 'https://solscan.io/tx/';

async function fetchAllSignatures() {
  const connection = new Connection(RPC, 'confirmed');
  const mint = new PublicKey(USDC_MINT);
  const wallet = new PublicKey(WALLET);
  const ata = getAssociatedTokenAddressSync(mint, wallet);

  const allSigs = [];
  let before = undefined;

  while (true) {
    const batch = await connection.getSignaturesForAddress(ata, {
      limit: 1000,
      before,
    });
    if (batch.length === 0) break;
    allSigs.push(...batch);
    before = batch[batch.length - 1].signature;
    // Rate limit protection
    await new Promise(r => setTimeout(r, 500));
  }

  return allSigs;
}

async function main() {
  const sigs = await fetchAllSignatures();

  console.log('# On-Chain USDC Transaction Log');
  console.log();
  console.log(`All USDC transactions for agent wallet [\`${WALLET}\`](https://solscan.io/account/${WALLET}) on Solana mainnet.`);
  console.log();
  console.log(`**Total transactions:** ${sigs.length}`);
  console.log(`**Generated:** ${new Date().toISOString()}`);
  console.log();
  console.log('---');
  console.log();
  console.log('| # | Signature | Time (UTC) | Status |');
  console.log('|---:|---|---|---|');

  sigs.reverse(); // oldest first

  for (let i = 0; i < sigs.length; i++) {
    const s = sigs[i];
    const short = s.signature.slice(0, 16) + '...';
    const time = s.blockTime
      ? new Date(s.blockTime * 1000).toISOString().replace('T', ' ').slice(0, 19)
      : 'unknown';
    const status = s.err ? '❌ error' : '✅';
    console.log(`| ${i + 1} | [\`${short}\`](${SOLSCAN}${s.signature}) | ${time} | ${status} |`);
  }

  console.log();
  console.log(`---`);
  console.log();
  console.log(`Verify any transaction: click the signature link or search on [Solscan](https://solscan.io/account/${WALLET}).`);
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
