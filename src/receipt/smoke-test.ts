/**
 * Smoke test for Piece 5 — on-chain Memo v2 receipts.
 *
 * Exercises everything checkable without mainnet: receipt building, the USDC
 * total, serialization, the byte-size guard, and the SPL Memo instruction. It
 * also runs the inscriber in dry-run mode. The live inscription path needs a
 * funded wallet and a Solana RPC, so it is not exercised here.
 */
import { Keypair } from '@solana/web3.js';
import {
  MEMO_PROGRAM_ID,
  MEMO_MAX_BYTES,
  buildReceipt,
  serializeReceipt,
  buildMemoInstruction,
} from './memo.js';
import { ReceiptInscriber } from './inscribe.js';
import type { CycleInput } from './types.js';
import type { WhaleEvent } from '../types.js';
import type { X402Payment } from '../x402/types.js';
import { log } from '../util/log.js';

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const PAY_TO = '5iVXFrYaYWX2GUTbkQj8mDBoBhAX8bneYigS2LJTia43';

function fakePayment(atomic: string, settled: boolean): X402Payment {
  return {
    settled,
    mode: settled ? 'live' : 'dry-run',
    signature: settled ? '5'.repeat(64) : undefined,
    amountAtomic: atomic,
    asset: USDC_MINT,
    network: 'solana',
    payTo: PAY_TO,
  };
}

const SAMPLE_EVENT: WhaleEvent = {
  id: '0x' + 'a3f9'.repeat(16),
  blockchain: 'ethereum',
  symbol: 'USDT',
  amount: 14_200_000,
  amountUsd: 14_200_000,
  fromLabel: 'unknown wallet',
  fromType: 'unknown',
  toLabel: 'binance',
  toType: 'exchange',
  txType: 'transfer',
  timestamp: new Date().toISOString(),
};

async function main(): Promise<void> {
  let failures = 0;
  const check = (label: string, ok: boolean, detail = ''): void => {
    if (ok) {
      log.info(`PASS  ${label}${detail ? ` — ${detail}` : ''}`);
    } else {
      failures++;
      log.error(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    }
  };

  // Real per-call x402 prices in USDC atomic units (6 decimals):
  // LLM $0.0952, image $0.0152, video $0.1133  ->  $0.2237 / cycle.
  const payments: (X402Payment | null)[] = [
    fakePayment('95200', true),
    fakePayment('15200', true),
    fakePayment('113300', true),
  ];
  const input: CycleInput = { cycle: 7, event: SAMPLE_EVENT, signal: 'BEARISH', payments };

  // 1. Receipt building.
  const receipt = buildReceipt(input);
  check('receipt agent tag', receipt.agent === 'whalewatch');
  check('receipt kind discriminator', receipt.kind === 'whale-cycle-receipt');
  check('receipt carries the whale event id', receipt.event === SAMPLE_EVENT.id);
  check('receipt cycle number', receipt.cycle === 7);
  check('x402 call count', receipt.x402.calls === 3, `calls=${receipt.x402.calls}`);
  check('x402 settled count', receipt.x402.settled === 3, `settled=${receipt.x402.settled}`);
  check('x402 USDC total', receipt.x402.spentUsdc === '0.223700', `spentUsdc=${receipt.x402.spentUsdc}`);

  // 2. Counts handle dry-run / null payments.
  const mixed = buildReceipt({
    ...input,
    payments: [fakePayment('95200', false), null, fakePayment('113300', true)],
  });
  check('settled count ignores unsettled + null', mixed.x402.settled === 1, `settled=${mixed.x402.settled}`);
  check('USDC total skips null payment', mixed.x402.spentUsdc === '0.208500', `spentUsdc=${mixed.x402.spentUsdc}`);

  // 3. Serialization + size guard.
  const memo = serializeReceipt(receipt);
  const bytes = Buffer.byteLength(memo, 'utf8');
  check('memo is a valid JSON round-trip', JSON.stringify(JSON.parse(memo)) === memo);
  check('memo within byte ceiling', bytes <= MEMO_MAX_BYTES, `${bytes} <= ${MEMO_MAX_BYTES} B`);

  // 4. SPL Memo instruction.
  const signer = Keypair.generate();
  const ix = buildMemoInstruction(memo, signer.publicKey);
  check('memo ix targets the SPL Memo program', ix.programId.equals(MEMO_PROGRAM_ID));
  check('memo ix lists exactly the signer', ix.keys.length === 1 && ix.keys[0]!.isSigner === true);
  check('memo ix data matches the memo bytes', ix.data.equals(Buffer.from(memo, 'utf8')));

  // 5. Oversized memo is rejected.
  let rejected = false;
  try {
    buildMemoInstruction('x'.repeat(MEMO_MAX_BYTES + 1), signer.publicKey);
  } catch {
    rejected = true;
  }
  check('oversized memo is rejected', rejected);

  // 6. Inscriber dry-run path — builds + logs, never sends, never needs a keypair.
  const inscriber = new ReceiptInscriber({
    mode: 'dry-run',
    rpcUrl: 'unused-in-dry-run',
    keypairPath: './does-not-exist.json',
  });
  const result = await inscriber.inscribe(input);
  check('dry-run inscriber does not inscribe', result.inscribed === false);
  check('dry-run inscriber returns no signature', result.signature === undefined);
  check(
    'dry-run inscriber returns a coherent receipt + memo',
    result.receipt.cycle === 7 &&
      result.receipt.event === SAMPLE_EVENT.id &&
      result.memo === serializeReceipt(result.receipt) &&
      result.bytes === Buffer.byteLength(result.memo, 'utf8'),
  );

  log.info('---');
  log.info(`Sample memo (${bytes} B): ${memo}`);
  log.info('Live inscription needs a funded wallet + Solana RPC; not exercised in this smoke test.');

  if (failures > 0) {
    log.error(`Receipt smoke test: ${failures} failure(s).`);
    process.exit(1);
  }
  log.info('Receipt smoke test: all checks passed.');
}

main().catch((err) => {
  log.error('Receipt smoke test crashed.', err);
  process.exit(1);
});
