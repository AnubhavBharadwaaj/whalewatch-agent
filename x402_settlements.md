# x402 Settlement Receipts

Six real USDC settlements on Solana mainnet via the Ace Data x402 facilitator path, signed by the WhaleWatch agent wallet. Settlement #6, made on May 29, 2026, is the one that closes the loop — it returned a full HTTP 200 chat completion from Ace Data's `gpt-4o-mini` endpoint after settling on-chain, proving the x402 path works end to end for service fulfillment and not just for the payment rail.

## Agent wallet

`FBykJfwmAyFK8mrqh1dgPAARFFCv1agUTGNfex6SDebj` — [Solscan](https://solscan.io/account/FBykJfwmAyFK8mrqh1dgPAARFFCv1agUTGNfex6SDebj)

## Settlement #6 — May 29, 2026 — payment + service fulfillment

The probe at [`src/probes/ace-x402-probe.ts`](./src/probes/ace-x402-probe.ts) hit `https://api.acedata.cloud/openai/chat/completions` with no auth header, got back a 402 listing three payment networks (Base, Solana, SKALE), settled the Solana option on-chain, and retried the request with the `X-PAYMENT` envelope. The retry returned HTTP 200 with a real chat completion.

- **Settlement tx:** [`4e37dfQFVsfwAHUx88BZaES6d4LMZbpLeRedq6DQp2UbmLu4b9T49KxvDczpKqbDDWkfeaBauFm189VzYTx6aMc`](https://solscan.io/tx/4e37dfQFVsfwAHUx88BZaES6d4LMZbpLeRedq6DQp2UbmLu4b9T49KxvDczpKqbDDWkfeaBauFm189VzYTx6aMc)
- **Amount:** `95215` USDC base units (0.095215 USDC)
- **payTo:** `5iVXFrYaYWX2GUTbkQj8mDBoBhAX8bneYigS2LJTia43`
- **Asset:** USDC-SPL (mint [`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`](https://solscan.io/token/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v))
- **Endpoint:** `https://api.acedata.cloud/openai/chat/completions`
- **Request:** `gpt-4o-mini`, `messages: [{role:user, content:"Say hi in 3 words"}]`, `max_tokens: 10`
- **Response status:** HTTP 200
- **Response content:** `"Hey there friend!"` (chatcmpl-89DgQl0VJP3dmy3DZy51AEnzOKeB0, 17 tokens total)

## Settlements #1–#5 — payment rail verification

These five came out of earlier integration work against the Ace Data facilitator. Each was a real 402 → SPL `TransferChecked` → confirmation cycle. They prove the settlement code (Solana wallet adapter, instruction construction, blockhash handling, signature submission) works against mainnet end to end on the payment side; settlement #6 above is the one that demonstrates the service-fulfillment side.

1. [`51gF7vSMfNdxxxYAEzyb1cbj8f2Ay1uhiGxVZefwS1B7M2b37wAgK6PZWSXUL2DgywRgtSTkhuaDsN2mWqyPNqKJ`](https://solscan.io/tx/51gF7vSMfNdxxxYAEzyb1cbj8f2Ay1uhiGxVZefwS1B7M2b37wAgK6PZWSXUL2DgywRgtSTkhuaDsN2mWqyPNqKJ)
2. [`5fA6WrzDZibMtQr2NDbH4AKsdbQJNd7Gp5QxkU6q53n7h7bGhgqM1bmF3Jz7JsMrqr18oPkgU66euMcf57Gb6TGv`](https://solscan.io/tx/5fA6WrzDZibMtQr2NDbH4AKsdbQJNd7Gp5QxkU6q53n7h7bGhgqM1bmF3Jz7JsMrqr18oPkgU66euMcf57Gb6TGv)
3. [`5Kc1CapWEgFkB5WVww1Dhn25v46aaSoyj4F1SfTquLg3CQv5pWTnxa5s3xRUxCvTJBizeDmjRuvzXp6ysPPnwLDj`](https://solscan.io/tx/5Kc1CapWEgFkB5WVww1Dhn25v46aaSoyj4F1SfTquLg3CQv5pWTnxa5s3xRUxCvTJBizeDmjRuvzXp6ysPPnwLDj)
4. [`4CrCjmbdHu6Zh5tEThe1nv29prDsPu9zZWJG8Cd9VqSjYETwyNLcM3eufxfeTJnjmRADAuG8UUPzJPiQfc1dnntU`](https://solscan.io/tx/4CrCjmbdHu6Zh5tEThe1nv29prDsPu9zZWJG8Cd9VqSjYETwyNLcM3eufxfeTJnjmRADAuG8UUPzJPiQfc1dnntU)
5. [`jhWKFRP2HfpkgbYxthxgfRrYRymri5TrBfJRth59M9QZgYmHxhqKKJNQ3zgknqVHPFd2cDJHgP8sZLWRHXSFy8L`](https://solscan.io/tx/jhWKFRP2HfpkgbYxthxgfRrYRymri5TrBfJRth59M9QZgYmHxhqKKJNQ3zgknqVHPFd2cDJHgP8sZLWRHXSFy8L)

All paid USDC-SPL (6 decimals, scheme `exact`) from the agent's Associated Token Account to the recipient supplied in the 402 response.

## How this relates to the May 28 live cycle

The May 28 live cycle ([memo `4NaV1G…`](https://solscan.io/tx/4NaV1GXgy96XMgKbp6gnrEeNzyQ6aYeYDWsjJg7t1Uz63dQr45EpHLJZTPpnDAWGxL3s6rDFeTeYvz77KnDdGBda)) currently fulfills its three Ace Data stages (analyze + image + video) through the credit path (account Bearer token). The analyze stage uses the same `/openai/chat/completions` endpoint that settlement #6 proved end-to-end on x402 — so flipping that stage from credit-path to x402 is now a mechanical code change, not an open question.

The image (DALL-E) and video (Luma) endpoints haven't been probed yet. The same approach should apply, but each gets verified independently before integration. Once both are confirmed, the live cycle routes all three stages through x402 so every whale event produces three on-chain Ace Data settlements per cycle.

## Reproduce

The probe code is at [`src/probes/ace-x402-probe.ts`](./src/probes/ace-x402-probe.ts). Run from the project root:

```bash
unset ACE_API_TOKEN  # required — with the token, the call goes credit-path and never returns 402
npx tsx src/probes/ace-x402-probe.ts
```

The probe prints the full 402 response body, selects the Solana entry from the `accepts` array, builds and confirms an SPL `TransferChecked` for the required USDC amount, and retries the request with a base64-encoded `X-PAYMENT` envelope of the form `{x402Version:2, scheme:"exact", network:"solana", payload:{signature:<tx_sig>}}`. Cost per run: 0.095 USDC plus a few thousand lamports of SOL fee.
