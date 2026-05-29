# WhaleWatch Agent

Autonomous SAP-registered agent for the OOBE Protocol x Ace Data Cloud bounty
(Category 2). It converts $10M+ whale movements into a paid LLM-analysis +
image + video bundle, settling each Ace Data Cloud call over x402 on Solana.

Built in pieces. **In this drop: Piece 1 (trigger), Piece 2a (x402 client),
Piece 2b (LLM analysis stage).**

## Run it

```bash
npm install
cp .env.example .env
npm run smoke:x402   # tests the x402 client dry-run path (hermetic)
npm run smoke:llm    # tests the LLM analysis stage + JSON parser (hermetic)
npm start            # runs the agent: trigger -> LLM analysis
```

Both smoke tests should print `SMOKE TEST PASSED`. They use local mock servers —
no API key, no wallet, no network, no spend.

`npm start` with the template `.env` runs in **dry-run** on the **mock** whale
source: it generates whale events and runs each through the LLM stage. In
dry-run the LLM stage probes the Ace Data endpoint for its 402 price, then
returns a clearly-marked stub analysis — no USDC moves.

## Modes

`AGENT_MODE` in `.env` is `dry-run` in the template (safe). The code default,
if unset, is `live` — which signs and settles real USDC and needs a funded
keypair at `AGENT_KEYPAIR_PATH`. dry-run is always an explicit opt-in.

## The data-source decision (open, not blocking)

Whale Alert's REST API is fully key-gated — no free tier. The `WhaleEventSource`
interface keeps the provider swappable: `MockWhaleSource` runs now with no key;
`WhaleAlertSource` is the real adapter, inert until `WHALE_ALERT_API_KEY` is set.

## Layout

```
src/
  config.ts                 env-driven configuration
  types.ts                  shared domain types
  index.ts                  poll loop: trigger -> dedupe -> LLM analysis
  util/log.ts               timestamped logger
  whale/                    event sources (interface, mock, Whale Alert)
  store/idempotency.ts      file-backed dedupe store, atomic writes
  acedata/endpoints.ts      Ace Data Cloud endpoint paths
  x402/                     x402 payment client (preview, dry-run, live) + smoke test
  solana/wallet.ts          loads the agent keypair, builds the wallet adapter
  llm/                      LLM analysis stage + smoke test
```

## Next pieces

3. Image + video generation stages (more x402 calls per event).
4. SAP registration on mainnet (v0.17 SDK + funded wallet).
5. Memo v2 receipt inscription.
6. Demo wiring.
