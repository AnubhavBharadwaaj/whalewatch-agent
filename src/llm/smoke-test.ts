import { createServer } from 'node:http';
import { X402Client } from '../x402/client.js';
import { analyzeWhaleEvent, extractJson, toWhaleAnalysis } from './analyze.js';
import type { WhaleEvent } from '../types.js';

/**
 * Hermetic smoke test for the LLM analysis stage.
 *  - dry-run path: against a local mock 402 server, no key, no spend.
 *  - JSON parser: pure / fenced / preamble-wrapped LLM output.
 * Run: npm run smoke:llm
 */

const sampleEvent: WhaleEvent = {
  id: '0xtest',
  blockchain: 'solana',
  symbol: 'SOL',
  amount: 100_000,
  amountUsd: 18_000_000,
  fromLabel: 'unknown wallet',
  fromType: 'unknown',
  toLabel: 'Binance',
  toType: 'exchange',
  txType: 'transfer',
  timestamp: new Date().toISOString(),
};

const fake402 = JSON.stringify({
  x402Version: 2,
  accepts: [
    {
      scheme: 'exact',
      network: 'solana',
      maxAmountRequired: '1500',
      maxTimeoutSeconds: 120,
      resource: '/openai/chat/completions',
      description: 'chat',
      payTo: 'AceMock11111111111111111111111111111111111',
      asset: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      extra: { decimals: 6 },
    },
  ],
});

async function testDryRun(): Promise<boolean> {
  const server = createServer((_req, res) => {
    res.writeHead(402, { 'Content-Type': 'application/json' });
    res.end(fake402);
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;
  try {
    const x402 = new X402Client({ mode: 'dry-run' });
    const result = await analyzeWhaleEvent(sampleEvent, x402, {
      baseUrl: `http://127.0.0.1:${port}`,
      model: 'gpt-4o-mini',
    });
    console.log('dry-run analysis ->', JSON.stringify(result.analysis));
    return (
      result.stub === true &&
      result.payment?.settled === false &&
      // toType=exchange -> BEARISH heuristic
      result.analysis.signal === 'BEARISH'
    );
  } finally {
    server.close();
  }
}

function testParser(): boolean {
  const pure = '{"token":"SOL","signal":"bullish","one_line":"x","analysis":"y"}';
  const fenced = '```json\n{"token":"ETH","signal":"BEARISH"}\n```';
  const preamble = 'Here is the analysis:\n{"token":"BTC","signal":"weird"}\nDone.';
  const a = toWhaleAnalysis(extractJson(pure), sampleEvent);
  const b = toWhaleAnalysis(extractJson(fenced), sampleEvent);
  const c = toWhaleAnalysis(extractJson(preamble), sampleEvent);
  console.log('parser ->', `pure=${a.signal}`, `fenced=${b.token}`, `preamble=${c.signal}`);
  return (
    a.signal === 'BULLISH' && // lowercase coerced
    b.token === 'ETH' && // fenced JSON extracted
    c.signal === 'NEUTRAL' // invalid signal coerced to NEUTRAL
  );
}

async function main(): Promise<void> {
  const dryRunOk = await testDryRun();
  const parserOk = testParser();
  console.log(`dry-run: ${dryRunOk ? 'ok' : 'FAIL'}, parser: ${parserOk ? 'ok' : 'FAIL'}`);
  const pass = dryRunOk && parserOk;
  console.log(pass ? 'SMOKE TEST PASSED' : 'SMOKE TEST FAILED');
  process.exitCode = pass ? 0 : 1;
}

main().catch((err) => {
  console.error('SMOKE TEST ERROR', err);
  process.exitCode = 1;
});
