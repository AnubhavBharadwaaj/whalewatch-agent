# x402 Settlement Receipts

Five real USDC settlements on Solana mainnet via the Ace Data x402 facilitator path, signed by the WhaleWatch agent wallet during payment-rail integration. Each one was triggered by a real `402 Payment Required` response from an Ace Data service endpoint and acknowledged by the facilitator after on-chain settlement.

## Agent wallet

`FBykJfwmAyFK8mrqh1dgPAARFFCv1agUTGNfex6SDebj` — [Solscan](https://solscan.io/account/FBykJfwmAyFK8mrqh1dgPAARFFCv1agUTGNfex6SDebj)

## Settlements



1. `51gF7vSMfNdxxxYAEzyb1cbj8f2Ay1uhiGxVZefwS1B7M2b37wAgK6PZWSXUL2DgywRgtSTkhuaDsN2mWqyPNqKJ` — [Solscan](https://solscan.io/tx/51gF7v)
2. `5fA6WrzDZibMtQr2NDbH4AKsdbQJNd7Gp5QxkU6q53n7h7bGhgqM1bmF3Jz7JsMrqr18oPkgU66euMcf57Gb6TGv` — [Solscan](https://solscan.io/tx/5fA6Wrz)
3. `5Kc1CapWEgFkB5WVww1Dhn25v46aaSoyj4F1SfTquLg3CQv5pWTnxa5s3xRUxCvTJBizeDmjRuvzXp6ysPPnwLDj` — [Solscan](https://solscan.io/tx/5Kc1Cap)
4. `4CrCjmbdHu6Zh5tEThe1nv29prDsPu9zZWJG8Cd9VqSjYETwyNLcM3eufxfeTJnjmRADAuG8UUPzJPiQfc1dnntU` — [Solscan](https://solscan.io/tx/4CrCjmb)
5. `jhWKFRP2HfpkgbYxthxgfRrYRymri5TrBfJRth59M9QZgYmHxhqKKJNQ3zgknqVHPFd2cDJHgP8sZLWRHXSFy8L` — [Solscan](https://solscan.io/tx/jhWKFRP)

All five paid USDC-SPL (mint [`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`](https://solscan.io/token/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v), 6 decimals, scheme `exact`) from the agent's Associated Token Account to the recipient supplied in the `PaymentRequired` response from the Ace Data service endpoint.

## What these settlements prove

The agent's settlement code works end to end on Solana mainnet against real Ace Data service endpoints: Solana wallet adapter, SPL `TransferChecked` construction, blockhash management, signature submission to the facilitator, and the retry of the original service request with the `X-PAYMENT-SIGNATURE` envelope. Five different transactions, five different on-chain hashes, all verifiable on Solscan.

## How this relates to the current live cycle

The May 28 end-to-end live cycle ([memo `4NaV1G…`](https://solscan.io/tx/4NaV1GXgy96XMgKbp6gnrEeNzyQ6aYeYDWsjJg7t1Uz63dQr45EpHLJZTPpnDAWGxL3s6rDFeTeYvz77KnDdGBda)) fulfills the three Ace Data services through the credit path (account Bearer token), not x402. The reason isn't the payment rail — these five settlements demonstrate that part is sound — but a service-side routing issue: x402-paid calls return `no available channel under group default`, while the same call with the account token attached fulfills normally. That points at how an x402 payment maps to my account's provisioned model channels, which is a platform-side question being chased with the Ace Data dev team via the bounty organisers.

When the routing question lands, the agent flips back to per-call x402 with no architectural change. The five settlements above become the floor, not the ceiling — the same pattern runs once per service call, three times per whale event, for every cycle the agent completes through the judging window.
