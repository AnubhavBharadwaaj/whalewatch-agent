import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { X402Client } from '../x402/client.js';
import type { SolanaWalletAdapter } from '@acedatacloud/x402-client';
import { runMediaTask, findMediaUrl } from './task.js';
import { buildImagePrompt, usdShort } from './image.js';
import { buildVideoPrompt } from './video.js';
import type { WhaleAnalysis } from '../types.js';

/**
 * Hermetic smoke test for the media stages.
 *  - dry-run: against a mock 402 server — no key, no spend.
 *  - poll state machine: against a mock that returns a task id, then
 *    'processing' twice, then a finished asset URL — live mode, no real chain.
 *  - prompt builders: pure-function checks.
 * Run: npm run smoke:media
 */

const analysis: WhaleAnalysis = {
  token: 'SOL',
  direction: 'outflow',
  usd_value: 148_000_000,
  from_entity: 'Binance',
  to_entity: 'unknown wallet',
  signal: 'BULLISH',
  one_line: 'Large SOL outflow from Binance',
  analysis: 'A sizeable withdrawal from an exchange.',
};

// Live X402Client needs a wallet; this one is never used because the mock
// server never returns 402.
const unusedWallet: SolanaWalletAdapter = {
  publicKey: { toBase58: () => 'Unused', toString: () => 'Unused' },
  signAndSendTransaction: () => Promise.reject(new Error('wallet should not be used in this test')),
};

const fake402 = JSON.stringify({
  x402Version: 2,
  accepts: [
    {
      scheme: 'exact',
      network: 'solana',
      maxAmountRequired: '120000',
      maxTimeoutSeconds: 120,
      resource: '/flux/images',
      description: 'image',
      payTo: 'AceMock11111111111111111111111111111111111',
      asset: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      extra: { decimals: 6 },
    },
  ],
});

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let s = '';
    req.on('data', (c) => (s += c));
    req.on('end', () => resolve(s));
  });
}

async function testDryRun(): Promise<boolean> {
  const server = createServer((_req, res) => {
    res.writeHead(402, { 'Content-Type': 'application/json' });
    res.end(fake402);
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;
  try {
    const x402 = new X402Client({ mode: 'dry-run' });
    const result = await runMediaTask(
      {
        label: 'image',
        submitUrl: `http://127.0.0.1:${port}/flux/images`,
        taskUrl: `http://127.0.0.1:${port}/flux/tasks`,
        requestBody: { prompt: 'x' },
        pollIntervalMs: 10,
        maxPolls: 3,
      },
      x402,
    );
    console.log('dry-run ->', JSON.stringify(result));
    return result.stub === true && result.url === null && result.payment?.settled === false;
  } finally {
    server.close();
  }
}

async function testPollStateMachine(): Promise<boolean> {
  let polls = 0;
  const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    await readBody(req);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (req.url?.includes('/flux/images')) {
      res.end(JSON.stringify({ task_id: 'task-abc' }));
      return;
    }
    polls += 1;
    if (polls >= 3) {
      res.end(JSON.stringify({ status: 'success', data: { image_url: 'https://cdn.example/whale.png' } }));
    } else {
      res.end(JSON.stringify({ status: 'processing' }));
    }
  };
  const server = createServer((req, res) => void handler(req, res));
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;
  try {
    const x402 = new X402Client({ mode: 'live', wallet: unusedWallet });
    const result = await runMediaTask(
      {
        label: 'image',
        submitUrl: `http://127.0.0.1:${port}/flux/images`,
        taskUrl: `http://127.0.0.1:${port}/flux/tasks`,
        requestBody: { prompt: 'x' },
        pollIntervalMs: 20,
        maxPolls: 10,
      },
      x402,
    );
    console.log('poll state machine ->', JSON.stringify(result));
    return result.stub === false && result.url === 'https://cdn.example/whale.png' && polls >= 3;
  } finally {
    server.close();
  }
}

function testPrompts(): boolean {
  const img = buildImagePrompt(analysis);
  const vid = buildVideoPrompt(analysis);
  console.log('image prompt ->', img);
  console.log('video prompt ->', vid);
  return (
    usdShort(148_000_000) === '$148M' &&
    img.includes('$148M') &&
    img.includes('upward green') && // BULLISH arrow
    vid.includes('confident') && // BULLISH mood
    findMediaUrl({ a: { b: 'https://x.test/clip.mp4' } }) === 'https://x.test/clip.mp4'
  );
}

async function main(): Promise<void> {
  const dryRunOk = await testDryRun();
  const pollOk = await testPollStateMachine();
  const promptsOk = testPrompts();
  console.log(
    `dry-run: ${dryRunOk ? 'ok' : 'FAIL'}, polling: ${pollOk ? 'ok' : 'FAIL'}, ` +
      `prompts: ${promptsOk ? 'ok' : 'FAIL'}`,
  );
  const pass = dryRunOk && pollOk && promptsOk;
  console.log(pass ? 'SMOKE TEST PASSED' : 'SMOKE TEST FAILED');
  process.exitCode = pass ? 0 : 1;
}

main().catch((err) => {
  console.error('SMOKE TEST ERROR', err);
  process.exitCode = 1;
});
