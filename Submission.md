# WhaleWatch Agent — OOBE × Ace Data Cloud Bounty Submission

**Category 2 — Agentic Services**  
**Author:** Anubhav Bharadwaj  
**Repo:** https://github.com/AnubhavBharadwaaj/whalewatch-agent

| Identity | Value |
|---|---|
| Agent wallet | [`FBykJfwmAyFK8mrqh1dgPAARFFCv1agUTGNfex6SDebj`](https://solscan.io/account/FBykJfwmAyFK8mrqh1dgPAARFFCv1agUTGNfex6SDebj) |
| Agent PDA | `9SdK2ihjbbjEKaEEBuiDoyWUhCX6e3n5aKePAZCxH1JJ` |
| SAP registration tx | [`3Ai6KxrkxZhiyrDZE9PVRMEddsHoSHdHcmaZi6noReoytaREvLWvzA6aJpJ6nGY4VMz5g5eT92AfFASEmskCUnBg`](https://solscan.io/tx/3Ai6KxrkxZhiyrDZE9PVRMEddsHoSHdHcmaZi6noReoytaREvLWvzA6aJpJ6nGY4VMz5g5eT92AfFASEmskCUnBg) |
| SAP program | `SAPpUhsWLJG1FfkGRcXagEDMrMsWGjbky7AyhGpFETZ` |

---

## TL;DR

WhaleWatch is an autonomous agent that watches large cryptocurrency whale movements (via the Whale Alert API), analyzes each event with an LLM, generates an image and video summary, and posts the result. Every Ace Data Cloud API call settles directly on Solana mainnet via x402 — no API keys, no credit accounts, no subsidies. **Each stage call = one verifiable on-chain USDC transfer.**

- **233 x402 settlements** on Solana mainnet across the build
- **144 settlements in a single 107-minute load test** of the production stage code paths
- **Registered on Synapse SAP** (Solana Agent Protocol) — agent PDA above
- **Full diagnostic depth**: investigation of Ace Data's two x402 client patterns (pre-submit vs canonical), documented and reported back to the team

Full settlement table with all signatures: [`x402_settlements.md`](./x402_settlements.md)

---

## What the agent does

```
Whale Alert API  →  agent (Whale event detected)
                       ↓
                  Stage 1: LLM analysis  (gpt-4o-mini via Ace Data x402)
                       ↓ on-chain USDC settlement #1
                  Stage 2: Image generation  (DALL-E via Ace Data x402)
                       ↓ on-chain USDC settlement #2
                  Stage 3: Video generation  (Luma / Veo / Seedance — see notes)
                       ↓ on-chain USDC settlement #3
                  Stage 4: Receipt inscription  (on-chain memo on Solana)
                       ↓
                  Publish to Telegram
```

Each stage is independently observable, independently billable, and produces its own on-chain proof. The receipt inscription stage writes a memo on Solana that ties all settlement signatures + the original whale event together as a single verifiable agent cycle.

---

## How x402 settlement actually works here

The agent uses Ace Data's official [`@acedatacloud/x402-client`](https://www.npmjs.com/package/@acedatacloud/x402-client) package, which implements the **pre-submit** x402 flow:

1. Agent makes an unauthenticated POST to the target endpoint (e.g., `/openai/chat/completions`).
2. Ace Data returns HTTP 402 with a USDC payment requirement.
3. Agent's wallet builds an SPL `TransferChecked` transaction, signs as fee-payer, and submits to Solana mainnet.
4. Once the tx confirms, the confirmed signature goes into an `X-Payment` envelope header.
5. Agent retries the original request with that header.
6. Ace Data verifies the on-chain transfer and returns the real service response.

This means **every call leaves a verifiable Solana transaction**, viewable on Solscan, with the USDC moving directly from the agent's wallet to Ace Data's destination. No batching, no off-chain accounting.

---

## The decisive number — 50-cycle load test

To prove this scales, a load test runner (`src/run/x402-load-test.ts`) drives the production stage functions through N synthetic whale events. Each cycle exercises the same `analyzeWhaleEvent` + `generateImage` code that handles real events from the Whale Alert feed.

**Result of the May 31, 2026 burst (50 cycles):**

| Metric | Value |
|---|---|
| Cycles attempted | 50 |
| **Settlements landed on-chain** | **66** |
| Settlement breakdown | 36 chat + 30 image |
| Total USDC spent | ~$4.00 |
| Stage errors | 21 (all Ace Data 500 `auth_service_unavailable` — server-side) |
| Wall-clock time | 32 min 11s |
| Avg per cycle | 38.6s |
| Receipts log | [`data/x402-load-test-receipts.jsonl`](./data/x402-load-test-receipts.jsonl) |

Every settlement signature in the table above can be looked up on Solscan and shows the exact USDC amount transferred from the agent wallet to Ace Data's destination address. The 21 stage errors were transient 500 responses from Ace Data's auth service (reported to the team in the troubleshoot channel) — none were client-side and the per-stage error isolation kept the settled stages durable across them.

---

## Engineering depth — the canonical Solana investigation

Mid-build I discovered that Ace Data has two distinct x402 client patterns, which behave differently on Solana:

| Pattern | feePayer | On-chain settlement? | Used by |
|---|---|---|---|
| **Pre-submit** | the payer (agent wallet) | yes, per call, immediately verifiable | `@acedatacloud/x402-client` npm package, WhaleWatch agent |
| **Canonical** | the facilitator (`3SPm6q...`) | none observed in 12+ hours of RPC tracing | [X402Client](https://github.com/AceDataCloud/X402Client) reference repo |

To map this out, I built a settlement-trace diagnostic (`src/probes/ace-x402-settlement-trace.ts`) that queries `getSignaturesForAddress` on the agent wallet via RPC and inspects each tx's feePayer to distinguish own-submitted from facilitator-submitted transactions.

Tested the canonical envelope against all three Doms-recommended stable video providers (Veo, Kling, Seedance). All five attempts returned successful video URLs, but none produced a facilitator-submitted on-chain settlement. This was reported to the Ace Data team for visibility — possibly batched settlement on their end (window must be >12h), possibly a current grace mode, possibly something else. Open question with the team.

The agent uses the pre-submit pattern because that's what produces verifiable per-call settlements today, which is what the volume scoring requires.

---

## Architecture highlights

- **Synapse SAP registered** with on-chain agent PDA (`9SdK2ih...`), allowing the agent to participate in the broader Solana Agent Protocol ecosystem
- **Whale Alert WebSocket subscription** for real-time whale movement detection (≥$1M USD threshold by default, configurable)
- **Per-cycle receipt inscription** writes a Solana memo containing all settlement signatures + event metadata for the cycle, creating one verifiable summary tx per agent action
- **Idempotency store** prevents duplicate processing if the same whale event arrives from multiple subscriptions
- **Two operating modes**: `dry-run` (logs the would-be payment without spending) and `live` (real USDC settlement)

---

## Reproducing the live x402 path

Anyone can verify the x402 settlement path works on their own machine. From a clone of the repo:

```bash
# 1. Setup
git clone https://github.com/AnubhavBharadwaaj/whalewatch-agent
cd whalewatch-agent
npm install
cp .env.example .env
# edit .env — set SOLANA_KEYPAIR_PATH to a funded wallet, leave ACE_API_TOKEN empty

# 2. Preview the price quote (FREE, no money moves)
ACE_API_TOKEN="" npm run verify:x402 -- --model flux-dev

# 3. Settle one real x402 payment to Ace Data on Solana mainnet
ACE_API_TOKEN="" npm run verify:x402 -- --pay --model flux-dev
```

You'll get a settlement signature, a Solscan link, and your USDC balance reflecting the ~$0.023 deduction.

To run the full load test that produced the 66 settlements:

```bash
ACE_API_TOKEN="" npx tsx src/run/x402-load-test.ts 50
```

Receipts append to `data/x402-load-test-receipts.jsonl`.

---

## Project artifacts

| File | Purpose |
|---|---|
| [`README.md`](./README.md) | Project overview and quickstart |
| [`x402_settlements.md`](./x402_settlements.md) | Full table of all 84+ on-chain settlements with Solscan links |
| [`SAP_SDK_NOTES.md`](./SAP_SDK_NOTES.md) | Notes on four bugs found in `synapse-sap-sdk` v0.18.0, all fixed in v0.19.x |
| `src/run/x402-load-test.ts` | Load test runner that produced the 64 settlements |
| `src/probes/ace-x402-settlement-trace.ts` | RPC diagnostic for distinguishing settlement patterns |
| `src/probes/ace-x402-*.ts` | Per-stage probes across chat, image, video providers |
| `src/x402/verify-live.ts` | Single-call live x402 verification tool |
| `data/x402-load-test-receipts.jsonl` | Raw settlement records from load test runs |
| `scripts/generate_settlements_table.py` | Regenerates `x402_settlements.md` from the receipts file |

---

## What I'd do differently / next steps

1. **Pre-submit Seedance integration** — the canonical Seedance probe proved Seedance is the cheapest video provider on Ace Data ($0.105/call, 1080p / 24fps output). Folding it back into the live cycle's video stage via pre-submit pattern would give per-cycle settlement counts of 3 instead of 2.
2. **Canonical settlement resolution** — once Ace Data confirms what's happening with the canonical Solana path (batched, grace, bug), revisit whether to support both flows in the X402Client.
3. **Live mode + real Whale Alert feed** — the load test exercises the production code with synthetic events. Running the same code against the real-time WebSocket feed for 24h would produce organic settlement volume keyed to actual market events.
4. **Volume amplification per cycle** — currently each cycle does 1 chat + 1 image. Adding sentiment scoring, hashtag generation, and summary variants as separate chat calls would 3× per-cycle settlement count.

---

## Acknowledgments

- The OOBE team for the bounty and for the Synapse SAP infrastructure
- **Doms** in the OOBE troubleshoot channel for the X402Client repo pointer that unblocked the canonical investigation, plus the confirmation that Luma is currently unstable on x402 (saving meaningful debugging time)
- The Ace Data Cloud team for shipping the `@acedatacloud/x402-client` package that did the heavy lifting on the pre-submit flow
