# `src/run/`

Standalone executable scripts that exercise the production code paths
outside the main agent loop.

- **`x402-load-test.ts`** — runs N synthetic cycles through the same
  `analyzeWhaleEvent` and `generateImage` stage functions the live agent
  uses, to verify the x402 payment + retry path sustains repeated load.
  Each cycle produces two real on-chain USDC settlements to Ace Data.
  Receipts append to `data/x402-load-test-receipts.jsonl`.
