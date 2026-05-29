import { createServer } from 'node:http';
import { X402Client } from './client.js';

/**
 * Standalone smoke test for the x402 client's dry-run path. Spins up a local
 * server that always answers HTTP 402 with a Solana payment requirement, then
 * checks the client parses it and settles nothing. Proves the 402 parsing and
 * dry-run logic without a wallet, a key, or any on-chain activity.
 *
 * Run: npm run smoke:x402
 */

// USDC mint on Solana mainnet — realistic asset value in the mock requirement.
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const fake402Body = JSON.stringify({
  x402Version: 2,
  accepts: [
    {
      scheme: 'exact',
      network: 'solana',
      maxAmountRequired: '1500',
      maxTimeoutSeconds: 120,
      resource: '/openai/chat/completions',
      description: 'LLM chat completion',
      payTo: 'AceDataMockRecipient1111111111111111111111',
      asset: USDC_MINT,
      extra: { decimals: 6 },
    },
  ],
});

async function main(): Promise<void> {
  const server = createServer((_req, res) => {
    res.writeHead(402, { 'Content-Type': 'application/json' });
    res.end(fake402Body);
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;
  const url = `http://127.0.0.1:${port}/openai/chat/completions`;

  try {
    const client = new X402Client({ mode: 'dry-run' });

    const preview = await client.previewPrice(url);
    console.log('previewPrice ->', JSON.stringify(preview?.accepts?.[0]));

    const result = await client.request(url);
    console.log('request (dry-run) -> payment:', JSON.stringify(result.payment));

    const pass =
      preview?.accepts?.[0]?.network === 'solana' &&
      result.status === 402 &&
      result.payment?.settled === false &&
      result.payment?.mode === 'dry-run' &&
      result.payment?.amountAtomic === '1500' &&
      result.payment?.asset === USDC_MINT;

    console.log(pass ? 'SMOKE TEST PASSED' : 'SMOKE TEST FAILED');
    process.exitCode = pass ? 0 : 1;
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('SMOKE TEST ERROR', err);
  process.exitCode = 1;
});
