# WhaleWatch Agent

An autonomous agent that detects large cryptocurrency whale movements, analyzes them with an LLM, generates an image and video summary, and posts the result. Every Ace Data Cloud API call settles directly on Solana mainnet via x402 — no API keys, no credit accounts.

[![Verified on Solscan](https://img.shields.io/badge/verified-on--chain-success)](https://solscan.io/account/FBykJfwmAyFK8mrqh1dgPAARFFCv1agUTGNfex6SDebj)

## Headline

- **85+ x402 settlements on Solana mainnet** across the build
- **66 settlements in a single 32-minute production-code load test**
- Registered on Synapse SAP — agent PDA `9SdK2ihjbbjEKaEEBuiDoyWUhCX6e3n5aKePAZCxH1JJ`

Full details: [`Submission.md`](./Submission.md) · Receipts: [`x402_settlements.md`](./x402_settlements.md)

## How it works

```
Whale Alert  ──┐
               ▼
        ┌──────────────┐    ┌─────────────────────────────┐
        │  agent core  │ ── │ LLM analysis  (gpt-4o-mini) │ ─→ on-chain settlement
        │              │    └─────────────────────────────┘
        │              │    ┌─────────────────────────────┐
        │              │ ── │ Image generation (DALL-E)   │ ─→ on-chain settlement
        │              │    └─────────────────────────────┘
        │              │    ┌─────────────────────────────┐
        │              │ ── │ Video generation            │ ─→ on-chain settlement
        │              │    └─────────────────────────────┘
        │              │    ┌─────────────────────────────┐
        │              │ ── │ Receipt inscription (memo)  │
        └──────────────┘    └─────────────────────────────┘
                                          │
                                          ▼
                                      Telegram
```

Each Ace Data Cloud call settles a separate USDC payment on Solana mainnet via the [`@acedatacloud/x402-client`](https://www.npmjs.com/package/@acedatacloud/x402-client) package. The wallet builds, signs, and submits the SPL TransferChecked, then retries the request with an `X-Payment` envelope containing the confirmed signature.

## Quickstart

```bash
git clone https://github.com/AnubhavBharadwaaj/whalewatch-agent
cd whalewatch-agent
npm install
cp .env.example .env
# edit .env — set SOLANA_KEYPAIR_PATH to a funded wallet
```

### Verify the x402 path with a single paid call (~$0.023 USDC)

```bash
ACE_API_TOKEN="" npm run verify:x402 -- --model flux-dev          # preview only
ACE_API_TOKEN="" npm run verify:x402 -- --pay --model flux-dev    # settle one payment
```

### Run the production-code load test

```bash
ACE_API_TOKEN="" npx tsx src/run/x402-load-test.ts 50
```

Each cycle exercises the same `analyzeWhaleEvent` and `generateImage` functions the live agent uses, producing two real on-chain USDC settlements per cycle. Receipts append to `data/x402-load-test-receipts.jsonl`.

### Regenerate the settlements table

```bash
python3 scripts/generate_settlements_table.py > x402_settlements.md
```

### Run the live agent against the Whale Alert feed

```bash
npm start
```

Set `AGENT_MODE=live` in `.env` for real settlements, or leave it at `dry-run` to log without spending.

## Project layout

```
src/
├── index.ts              # main agent loop — whale event → 3-stage pipeline → publish
├── x402/                 # x402 client wrapper + verification + smoke tests
├── llm/analyze.ts        # whale event → structured analysis (stage 1)
├── media/image.ts        # analysis → image URL (stage 2)
├── media/video.ts        # analysis → video URL (stage 3)
├── receipt/              # on-chain memo inscription per cycle
├── sap/                  # Synapse SAP registration
├── whale/                # whale event sources (Whale Alert WS, mock, ETH RPC)
├── probes/               # standalone x402 probes per service & investigation
└── run/x402-load-test.ts # load test runner that produced the 64 settlements
```

## License

MIT
