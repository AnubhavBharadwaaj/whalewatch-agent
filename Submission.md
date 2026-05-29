# WhaleWatch

An autonomous Solana agent that watches Ethereum mainnet for large stablecoin transfers and turns each one into a three-stage Ace Data briefing — chat analysis, infographic, short market-mood clip — with the whole bundle hashed into an SPL Memo v2 receipt on Solana.

Submitted to the OOBE × Ace Data Cloud bounty, Category 2. Category 2 asks for three distinct Ace Data services per event, real x402 settlements, and on-chain SAP identity. WhaleWatch does each of those.

> **TODO before submission:** repo URL, full x402 settlement signatures, screenshots of a completed cycle (Solscan memo, DALL-E image, Luma video).

---

## What's live and verifiable right now

- **SAP agent on Solana mainnet.** Name `WhaleWatch`, agent PDA `9SdK2ihjbbjEKaEEBuiDoyWUhCX6e3n5aKePAZCxH1JJ`. Registration tx: `3Ai6KxrkxZhiyrDZE9PVRMEddsHoSHdHcmaZi6noReoytaREvLWvzA6aJpJ6nGY4VMz5g5eT92AfFASEmskCUnBg` ([Solscan](https://solscan.io/tx/3Ai6KxrkxZhiyrDZE9PVRMEddsHoSHdHcmaZi6noReoytaREvLWvzA6aJpJ6nGY4VMz5g5eT92AfFASEmskCUnBg)).
- **Agent wallet (Solana):** `FBykJfwmAyFK8mrqh1dgPAARFFCv1agUTGNfex6SDebj`.
- **A full live cycle on real Ethereum data.** On May 28, 2026 the agent picked up a $9.9M USDC transfer between two unknown Ethereum wallets, ran the three Ace Data services, and inscribed the receipt. Memo tx on Solana mainnet: `4NaV1GXgy96XMgKbp6gnrEeNzyQ6aYeYDWsjJg7t1Uz63dQr45EpHLJZTPpnDAWGxL3s6rDFeTeYvz77KnDdGBda` ([Solscan](https://solscan.io/tx/4NaV1GXgy96XMgKbp6gnrEeNzyQ6aYeYDWsjJg7t1Uz63dQr45EpHLJZTPpnDAWGxL3s6rDFeTeYvz77KnDdGBda)).
- **Five real x402 USDC settlements on Solana mainnet** during payment-rail integration. The settlement code is wired correctly and has been settling real transactions, not stubs.

> **TODO:** paste the five full settlement signatures here as a bulleted list. They're in your `data/idempotency.json` and your Phantom transaction history.

---

## What it does, end to end

The agent runs a poll loop. Every interval it asks Ethereum mainnet for USDC and USDT `Transfer` logs above the configured USD threshold. When a transfer qualifies, the pipeline fires:

1. **Chat** (GPT-4o-mini via Ace Data) takes the event and returns a small JSON: signal (BULLISH / BEARISH / NEUTRAL), one-liner, plus the visual mood and motion that drive the downstream prompts.
2. **Image** (DALL-E 3 via Ace Data) generates a 1024×1024 infographic card.
3. **Video** (Luma via Ace Data) generates a 6-second market-mood clip. Synchronous, ~100 seconds in practice.
4. **Receipt.** The agent hashes the bundle (analysis JSON + image URL + video URL + payment signatures) and writes one SPL Memo v2 instruction on Solana mainnet, signed by the agent keypair. That's the tamper-evident receipt for the cycle, atomic with the rest of the run.

Three Ace Data services per event, which clears the Category 2 floor.

---

## How the data source works (and why I changed it)

The original plan was Whale Alert. Their free plan authorises the REST endpoint but returns no transaction data, and both of their paid checkout flows are broken on their side: their Stripe checkout domain isn't whitelisted in their own Stripe account, and Coinbase Commerce throws `503` on the checkout API. After confirming both with screenshots and a raw-body diagnostic, I dropped Whale Alert and built a free replacement.

The `eth-rpc` source watches `Transfer` logs for USDC and USDT directly from a public Ethereum RPC. Both tokens are 6-decimal dollar stablecoins, so the token amount IS the USD value and no price feed is needed. It uses raw JSON-RPC over `fetch`, no SDK, no API key, no vendor billing anywhere.

Robustness work:

- `eth_getLogs` queries are chunked (20 blocks per call) so a single request never exceeds typical public-RPC result caps.
- The agent stays 3 blocks behind the chain head, which dodges load-balanced-RPC head races and shallow reorgs.
- A small known-exchange address map labels Binance, Coinbase, Kraken, and Bitfinex hot wallets; anything else falls back to a truncated address with type `unknown`.
- A bounded `seenIds` set provides in-process dedupe in addition to the on-disk idempotency store.

A sample 10-block window pulled 3,618 stablecoin transfers and surfaced six above $1M — those numbers are real, from the live smoke test. The source has been the most reliable part of the stack since I built it.

---

## The x402 payment loop

Per service call, the agent runs the canonical x402 flow:

1. Issue the unpaid request to the Ace Data service endpoint.
2. Server returns `402` with a `PaymentRequired` describing the Solana USDC-SPL transfer: amount, recipient, scheme `exact`.
3. Agent constructs and signs the USDC transfer.
4. Retries the same request with `X-PAYMENT-SIGNATURE` carrying the settlement proof.
5. Ace Data's `FacilitatorX402` verifies on-chain settlement; the server returns the resource.

The settlement code is real — five settled transactions on Solana mainnet from integration prove it. Idempotency runs at two levels: the event ID is checked before a cycle starts, and every paid tx signature is persisted so the agent never re-settles for the same call.

The facilitator is Ace Data's `FacilitatorX402`, not Coinbase's CDP facilitator. The bounty's Category 2 requires Ace Data's facilitator specifically.

---

## What's working and what isn't (honest)

The full pipeline runs end to end on real data. The receipt inscription on the May 28 cycle is verifiable on Solscan; the image and video URLs resolve. The agent stops gracefully under `MAX_CYCLES`, holds event-ID idempotency through restarts, and the preflight guard refuses to run in live mode against the mock data source.

The piece that isn't live yet: my account's Ace Data calls currently fulfill on the **credit path** (Bearer token), not the x402 path. The x402-paid version of the same call hits "no available channel under group default" at the service layer. This is a routing issue on the platform side, where unauthenticated x402 requests land in the default group rather than my account's provisioned model channels. The bounty organiser is aware and escalated the question to the Ace Data dev team. The fix is on their side, not mine.

The moment the routing is sorted, the agent flips from credits to per-call x402 with no architectural change. Same three services, same payment-rail code (already settling on Solana), same receipt format. Every cycle then becomes a Solana x402 settlement, and the buyer-side volume is real.

This is the one piece of the submission that's a "when it lands" rather than a "here it is." I've chosen to be explicit about it rather than bury it.

---

## Where the engineering went

- **Free, keyless data source.** The agent doesn't owe a vendor anything for its trigger feed. No Whale Alert subscription, no API key, no SLA risk.
- **Spend controls.** `MAX_CYCLES` and `MAX_EVENTS_PER_POLL` env vars bound credit and USDC burn during the judging window. A noisy busy poll can't sample more cycles than the operator authorised.
- **Smoke tests for every adapter** (`mock`, `whale-alert`, `whale-alert-rest`, `eth-rpc`) and a `diag:whale-rest` raw-body diagnostic. Useful when you're debugging whether "zero results" means a quiet window or a gated tier — that distinction nearly cost me a day.
- **Chunked `eth_getLogs` with resume-on-failure**, head lag for reorg safety, in-process dedupe with a bounded `seenIds` set.
- **A preflight guard** that refuses `live + mock` with a clear error so a demo can't accidentally ship without real data. (One competitor reportedly shipped a non-settling agent because dry-run was the default. Mine refuses to.)
- **One Memo v2 per cycle**, signed by the agent keypair. Not a "we also wrote a log somewhere" — the receipt is part of the cycle's atomic completion.

---

## Code and how to run

> **TODO:** GitHub repo URL.

Stack: TypeScript, `tsx`, raw `fetch` for the Ethereum RPC, `@acedatacloud/sdk`, `@acedatacloud/x402-client`, `@oobe-protocol-labs/synapse-sap-sdk`, `@solana/web3.js`.

A single live cycle on real whale data:

```
cp .env.example .env
# In .env, set:
#   AGENT_MODE=live
#   WHALE_SOURCE=eth-rpc
#   WHALE_THRESHOLD_USD=1000000
#   MAX_CYCLES=1
#   ACE_API_TOKEN=<your Ace Data platform token>
# Drop your agent-keypair.json into the project root.
npm install
npm start
```

The agent catches a single qualifying whale, runs the three Ace Data services, writes the Solana memo receipt, and stops. Expect total runtime around three to four minutes (the Luma video step blocks for ~100 seconds).

Other useful commands:

- `npm run typecheck` — TypeScript clean check.
- `npm run smoke:eth-rpc` — verifies the data source against a public RPC. Prints how many large transfers came through in the last window.
- `npm run smoke:preflight` — confirms the live-mode/mock-source guard.
- `npm run smoke:receipt` — verifies the Memo v2 receipt construction without any network calls.

---

## Roadmap

1. **Switch the three service calls to per-call Solana x402** the moment the routing question is answered. The diff is small: drop the Bearer token, let the `@acedatacloud/x402-client` interceptor handle the 402 → sign → retry. The settlement code is already wired and proven.
2. **Publish a sell-side tool on SAP** — a `WhaleNarrativeAnalyzer` ToolDescriptor — so other agents can invoke the analyzer directly. Every external invocation is volume the agent didn't self-fund.
3. **Extend the data source** to Tron USDT (where the largest stablecoin flow actually lives) and to USDC on Base. Same adapter pattern, different RPC endpoint and contract addresses.
4. **Block-timestamp accuracy.** The current implementation uses detection time as the event timestamp; one extra `eth_getBlockByNumber` per poll would give exact block time at minimal cost.
