# x402 Settlements on Solana Mainnet

All payments below are real on-chain USDC transfers from the agent wallet on Solana mainnet, settled via the x402 protocol against Ace Data Cloud endpoints.

**Wallet:** [`FBykJfwmAyFK8mrqh1dgPAARFFCv1agUTGNfex6SDebj`](https://solscan.io/account/FBykJfwmAyFK8mrqh1dgPAARFFCv1agUTGNfex6SDebj)  
**Asset:** USDC (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`)  
**Counterparty (Ace Data):** [`5iVXFrYaYWX2GUTbkQj8mDBoBhAX8bneYigS2LJTia43`](https://solscan.io/account/5iVXFrYaYWX2GUTbkQj8mDBoBhAX8bneYigS2LJTia43)  

## Summary

| Source | Settlements | USDC settled |
|---|---:|---:|
| Load test | 222 | $15.710448 |
| Prior probes + verify + smoke | 20 | $3.347587 |
| **Total verifiable on-chain** | **242** | **$19.058035** |

---

## Load test — production cycles (May 31 – Jun 1, 2026)

Drove the production `analyzeWhaleEvent`, `generateImage`, and Seedance video
stage functions through synthetic whale events to validate that the live
x402 path scales. Per-stage error isolation kept settled stages durable
through Ace Data's intermittent auth-service 500s.

- Settlements landed: **222**
- Total spent: ~$15.710448 USDC
- Receipts: `data/x402-load-test-receipts.jsonl`

**Breakdown by stage:**

| Stage | Settled | USDC |
|---|---:|---:|
| chat | 90 | $8.569350 |
| image | 78 | $1.485354 |
| video | 54 | $5.655744 |

**All settlement signatures:**

| Cycle | Stage | USDC | Signature |
|---:|---|---:|---|
| 1 | chat | $0.095215 | [`3zUYtuoKa5mCCnWU...`](https://solscan.io/tx/3zUYtuoKa5mCCnWUxfuXzQArZeH7sbBdNncYJbYAHmcNyGqRXs1pcrbwW3eCcUysoT9nAqrG9LLoGiJAax8nC66H) |
| 1 | chat | $0.095215 | [`2omFya2tXvEiSbkH...`](https://solscan.io/tx/2omFya2tXvEiSbkH2K5ynqPK8iA5FZSbdvdZVMSVAd7FGVyPxsGyt9ysJapQPiHksQam3CJreGyi6zWmCWfDSFyz) |
| 1 | chat | $0.095215 | [`bRV61tfXy24MpEtA...`](https://solscan.io/tx/bRV61tfXy24MpEtAPm1ZCUfx2mfGqVN39GnKpcQDHokGnQ4XqnUrAAgGFu6yt6K4UurhxusdNVpCyssrLayiTW4) |
| 1 | chat | $0.095215 | [`2Vz7tis5y7FbXDy5...`](https://solscan.io/tx/2Vz7tis5y7FbXDy5npvWYojqUdeAzDVfRZC3wxdRFDEf515ffQ8jd8wkhq6RAuw7dhS2ziECDHbV7HprLWB6SyqK) |
| 1 | chat | $0.095215 | [`2r9CA2zBvGCy2CBr...`](https://solscan.io/tx/2r9CA2zBvGCy2CBrB8bwtx6BMyKwyEzjB19ANkjgfaQ9S9XzDRyP1GWfaH1rqyidadSyyYQddQARuj4qnAzHJA8d) |
| 1 | image | $0.019043 | [`588Z1x9YttaCzaoE...`](https://solscan.io/tx/588Z1x9YttaCzaoEP8wtDJ5SYYWH6m3PT1j5dt7MvitcmM6ZMNrGn5hb2Fzz3cWnAhrWfatns9E5ZDa285Qa2DKt) |
| 1 | image | $0.019043 | [`49XgY8P1zvQy16kp...`](https://solscan.io/tx/49XgY8P1zvQy16kphbUyBKRviSJ1aN2TP5z1XEvxJDBcSvToQ1j7rLKEDVAXKnEfoRuLCcuaDRPACmdiNHvNFtk2) |
| 1 | image | $0.019043 | [`47kkahTNC5dgVwqa...`](https://solscan.io/tx/47kkahTNC5dgVwqarKungPJUJkeLegfUEGigDZiCM3cjQaZ4SUR9zAs6bnfMXjP8j756LLhgaFpsNojEL9ZSdijQ) |
| 1 | image | $0.019043 | [`2G9SRSHEjdq4rC4x...`](https://solscan.io/tx/2G9SRSHEjdq4rC4xtfdarjzJyXBs3tfYDonmuQhLPxEZmiVkQFmXEesZJ3KS6H3NHHTzkBHnQZp7Hne88hb8J3JK) |
| 1 | image | $0.019043 | [`9tzfRqU3Sx49JRC6...`](https://solscan.io/tx/9tzfRqU3Sx49JRC6oT4HK2XpmuHbrbF49v5cZ69QuBFqLGqDAZAC18XUumetZNiWGpKgQGUf72MgTyfDz3wCtB2) |
| 1 | video | $0.104736 | [`3wzcQChBWTrUYiQt...`](https://solscan.io/tx/3wzcQChBWTrUYiQtfB229neEgQe1bjY34cSvdqWHGVnNhwucrCgoHYkBVDNxFKC9PRmHETNZ2iv7SFXg1p2ubAbY) |
| 1 | video | $0.104736 | [`5Kxw1YL9bXuN41x6...`](https://solscan.io/tx/5Kxw1YL9bXuN41x6uMiS2q3xTq4wWRYuKpG9PE4ttotagT13WxtoUmta7yFme418ZLPAG4akYuP5hSaJgdmf3J59) |
| 1 | video | $0.104736 | [`B5oYgQ19qU8z1ZE5...`](https://solscan.io/tx/B5oYgQ19qU8z1ZE53M94Pc49RzZZxzG6BPR6z75iTRTUSBuMrYk4LGTPQLnRKi4sF6c8PUUigriX42nCy7tqrrL) |
| 2 | chat | $0.095215 | [`3a8GneNGDcikp7TJ...`](https://solscan.io/tx/3a8GneNGDcikp7TJvCr2YNVnQErgUmxhMSbiMjc37KuzZidtRhg93APc2EYCWxphaffi5GRHWJUhPnYZDm8zTiB2) |
| 2 | chat | $0.095215 | [`4cZtYccRyKZy9Ppw...`](https://solscan.io/tx/4cZtYccRyKZy9PpwvQNVcKzq5S5TD7Hp7vAgxfWjVxEFH9qGX5ffHGh4HsbQwjXxEBqofuLxm3EKee1omuhE6dwf) |
| 2 | chat | $0.095215 | [`3sm5vN8dVFbfUkne...`](https://solscan.io/tx/3sm5vN8dVFbfUknewTmj5YjTNUVZZkjb36pjxkWHRbsh3MEeyu8MvVHkqvqDuGMCM8YwdeyjTnqCsMZU2A23vgHW) |
| 2 | image | $0.019043 | [`5pS3ADfXixVh9RD1...`](https://solscan.io/tx/5pS3ADfXixVh9RD1km1P7Bq9cB5EVrmuMiqbdTEeRCednjE7m1qbVWDgzuxbwBv2dptJWQez5F77KciiJG8DR75g) |
| 2 | image | $0.019043 | [`2VpwYkHmzzrF7ejE...`](https://solscan.io/tx/2VpwYkHmzzrF7ejEWdHc44naymSYumCTq9F2275X4NBxN4F9M4NSMjzt5ML1ZgnNCE8pSg8o4U64guvXcT5Fa1aB) |
| 2 | image | $0.019043 | [`5xeAx2PSTKwTFYnQ...`](https://solscan.io/tx/5xeAx2PSTKwTFYnQtPG3g5pKHRd1UrMvtYnvnZDtvTKm8DjD7GS8VtMpWxhfGFvvnirK27CZY9UCMceEebPkeReA) |
| 2 | video | $0.104736 | [`2cKxFg71SvtpPpsg...`](https://solscan.io/tx/2cKxFg71SvtpPpsgc9oQeoM8zqaWRnbFwPQkYnZdm1FtueMWKRSSfJguv4xwu8CbqoNopWp7QuUbJRFnZNdqUCeV) |
| 2 | video | $0.104736 | [`61APGnfwhhNEEoPL...`](https://solscan.io/tx/61APGnfwhhNEEoPLKwTbXwT8sfudwRaTPpqkAbuAkf2Eu9KN4Cg9Zsj6JPL5zd6mpFjXYDXFuA33QfA45pL1qttf) |
| 3 | chat | $0.095215 | [`2FTGsSXoe95urEVk...`](https://solscan.io/tx/2FTGsSXoe95urEVkxR1dPDGsAJoq3MfqHi5pJZNegLXvkVXnXf4kHco7NB4FQhc1puH6LiJZJYq7FvGTZraPF27R) |
| 3 | chat | $0.095215 | [`3SzF6wkn1EcMF3vY...`](https://solscan.io/tx/3SzF6wkn1EcMF3vYP3qvLWAA5X8BwYHR5Wb2yrZD5m7nBxaTmSV46CkCcr9m1WbHK5qr66L7UQNwAJ41GLjGbPn2) |
| 3 | chat | $0.095215 | [`53auhU9vQomhnWmP...`](https://solscan.io/tx/53auhU9vQomhnWmPM7d1MfVgTZKXaaQGEA76agbPH8M3cDAR7oPQRtBE8TXB1L7ZsPbfAer3GsFXgorMYSVGLkND) |
| 3 | image | $0.019043 | [`2UkeMZMbP9zcyLof...`](https://solscan.io/tx/2UkeMZMbP9zcyLofGzT2AahUWqB1cJkHY42zcqUikYhiUbae9fcaomjtvZZx3XSA6QXWiWYJxMdpNb6ofrTjwV3K) |
| 3 | image | $0.019043 | [`VWaFzGm4TQXoAXqv...`](https://solscan.io/tx/VWaFzGm4TQXoAXqv7Ps85i2tYBg8x2JNEynWcEhVNoVYbUK8Ek8jqzRh89K3M1gKDdGUbfm8omitGwJ1ndnnHhY) |
| 3 | video | $0.104736 | [`4FB6Np4bcZcejnax...`](https://solscan.io/tx/4FB6Np4bcZcejnaxoeeKv1qMwRmxF74WA6PChKVtt1NUPvrZdQZMUdpeAGgR9ocCGR6uhHpYcg3RLPevjAjL9HJ5) |
| 3 | video | $0.104736 | [`67NZ6uKiHEisdf9e...`](https://solscan.io/tx/67NZ6uKiHEisdf9eY2z5tJeDevdr5n9EVRMGBE1JZAZK5VqgZAad57jp9mBME2ZrbtcYt4vM5Gtye6G17478MKic) |
| 4 | chat | $0.095215 | [`74terzYQafEw4sgd...`](https://solscan.io/tx/74terzYQafEw4sgdW5LDPjPaZbwitPB8HTJV6SR6RG44MgD6f2GkbEPQryaiz6GoVB8JPu7CFnvLxWkrpa9dzgm) |
| 4 | chat | $0.095215 | [`257osRs7xJf1TfcE...`](https://solscan.io/tx/257osRs7xJf1TfcEhN9s4vJEbF3tY6Qvc3n4hJYfYXRfu2R9GgaygLD1VZtYbmiLmtUcLWPQFjyyEPSJn4pn6MJZ) |
| 4 | image | $0.019043 | [`4woiPRVpdCtrnPE7...`](https://solscan.io/tx/4woiPRVpdCtrnPE7ooXgugjy7U6uV5rTvHzYwNJ6gEGfiH3pHgawMN3uidmmVGVMUsNMnhuutpEUYY3v9xBiHduc) |
| 4 | video | $0.104736 | [`2SBdKsEkcQKUbs7V...`](https://solscan.io/tx/2SBdKsEkcQKUbs7VizTev7zpFQEDpQxdmpUiT5sji2PCwnzsWcKFKYrX7vLG8ALBWH67AJFTzyowu7ck4EXcJc4) |
| 5 | chat | $0.095215 | [`2VwwANWa43qovnSU...`](https://solscan.io/tx/2VwwANWa43qovnSUGiUbYywTTruKXwrmh9s72DuTssbAizNkX6U87osFmzUyTRMwy9ZFsVQJ9H5CrrYadeHy5GCE) |
| 5 | chat | $0.095215 | [`22bLedm3mSZmYgbg...`](https://solscan.io/tx/22bLedm3mSZmYgbgf8j3jpjN4DqchRH2yyjnS1B6oySDNS6gdHgZ5JjAKTaKEvp5sNAQHzCWAyvL7ALWr1MrTWNR) |
| 5 | image | $0.019043 | [`4gqKSziPF93oq5mN...`](https://solscan.io/tx/4gqKSziPF93oq5mNFxMKJzkK3rRR3rBKPdP8ugbAfoomUBBr4a6j76JnRxwsQspd4SAAgmbW4mQEhTJdsemBzsS7) |
| 5 | image | $0.019043 | [`2xhaMMB59u51jpFT...`](https://solscan.io/tx/2xhaMMB59u51jpFTY5DeJUCGJrpDVLkK51KgmymfZZnnZTqCuABcgomAtfjJZVGd2MC7wcGc8HjkMpqAxu5oYMGY) |
| 5 | video | $0.104736 | [`3T9NvLKtiWtVgNSH...`](https://solscan.io/tx/3T9NvLKtiWtVgNSH12BgTFX5tvx6TiUh4e5eaR57MVCKZEz1QS82stXYBdTDkPrrac1BrTENBeR65eYepXQnfM1X) |
| 6 | chat | $0.095215 | [`2m7bJjkeLFwxw324...`](https://solscan.io/tx/2m7bJjkeLFwxw324st1Sg5RwzhZ5jY4xHUEidNu8mGA9edwA5eKJjxVYD9viHraFpHhVEFSRFty2N5mZLaafhr5x) |
| 6 | chat | $0.095215 | [`LaTiEeAT1VoAfkkx...`](https://solscan.io/tx/LaTiEeAT1VoAfkkxR7TvEv4XtR4SV23zh172xyrwqfRfAfV6k8kxsVh3YfctKcSFeqRRkaG6nmtfs2PHSHxAJaS) |
| 6 | image | $0.019043 | [`4Jp1uKMqUmaL4XK2...`](https://solscan.io/tx/4Jp1uKMqUmaL4XK2k8KZvDaaChNFNRPpuyqtMNxaUHmb8iLTzoGrcCHTKnUL5Vo8xTB5mG9v5YWRv4PrPtJEcuA2) |
| 6 | image | $0.019043 | [`4c4aT2d1driceGdr...`](https://solscan.io/tx/4c4aT2d1driceGdrGzHR2MHfTatC31hZTTs92gcREu3ntz3yaenfZXcW4PxgU9mBgBHpo7MMyzQxLqfZzZqAAyHH) |
| 6 | video | $0.104736 | [`38XKWcfcjYTdAqSF...`](https://solscan.io/tx/38XKWcfcjYTdAqSF88MhfJfKTyD9Eu3yTct5oWjRDRSuqhycmNF5594FRkLetPT2dyZWMQXhtZRYU67XsS4TxAG6) |
| 7 | chat | $0.095215 | [`5GhXxkTCoA6BTRRG...`](https://solscan.io/tx/5GhXxkTCoA6BTRRGSgULEYVjAyytvb1bJbaLv3qggetzPWj3QUSuokVqG6D3t7MpR48F7Jb1F18yckVaz3iiiUCk) |
| 7 | chat | $0.095215 | [`4oib7q1CZRRD8jzD...`](https://solscan.io/tx/4oib7q1CZRRD8jzDCKXxEaRqb2WA3bUjJfzxDtH9aHSjD3xtBPyZzEgqDRwXJRzpuHj3zoYncX2s5WGcW1oZZetC) |
| 7 | image | $0.019043 | [`2EW94gk7iiFRLm1c...`](https://solscan.io/tx/2EW94gk7iiFRLm1cbjdjPR5hKVfG3eFUJgzv76zhUFVRHiEBmhjEfJqCbtQxp2KLDYD7JtoQ19FPjXtFStxUmXtM) |
| 7 | video | $0.104736 | [`2wJHx7mFCmszEsc7...`](https://solscan.io/tx/2wJHx7mFCmszEsc7Hn4a5dwBm7HEwcX39Y5c1mw61JjjYZekT2kmqmyQo3YmDCbqxUBxmEumqvigUYeP99vpbLXn) |
| 8 | chat | $0.095215 | [`5gLNQ1ffMEAjU2Lg...`](https://solscan.io/tx/5gLNQ1ffMEAjU2Lgc4dcCVFpWnVUiufDVteWxo9Pk4zEQ8B2BQG7bLXWKg7Mcauv375qA5QRmig3nVUnH4vLuFJ1) |
| 8 | chat | $0.095215 | [`2NMxgbeGiCWR8Snk...`](https://solscan.io/tx/2NMxgbeGiCWR8SnkWJVAhdtJKmwFFbyzYHfavHXFJc5yV5ezHX6PjD2VuukFaq8Mcm4AM7gtjd9iDjv3TNqn72uc) |
| 8 | image | $0.019043 | [`4whcooBPpTESsfXL...`](https://solscan.io/tx/4whcooBPpTESsfXLdeU2JqB3kwjYPVdgo3HYEbgQXvJphbG8pskHLboW6sAWwjMcqxNY9UkXSf4w7JJHQP2mPRHr) |
| 8 | image | $0.019043 | [`2ge6uRQEr3P1hjYX...`](https://solscan.io/tx/2ge6uRQEr3P1hjYXfxK6E8RHx6fQxGGtL9zzGrovEsCzot92QPcQzo5PvHqEcgsowcocwwryn7Y7zCCW3WYgGxNg) |
| 8 | video | $0.104736 | [`3E4neq5sjz8R9AaA...`](https://solscan.io/tx/3E4neq5sjz8R9AaAewfy5EJjFovASdDmqLqkfpTHGfZfRuJCwxkZos82G24Tp3xSNnPAgpMEfHPtJhN7mgPKyAiX) |
| 9 | chat | $0.095215 | [`2PHCLU6nNYVj2gSg...`](https://solscan.io/tx/2PHCLU6nNYVj2gSgGdv26V3Yh2MbQsRTyDiKwMDQW3iPGaiRz2G5qjN4ebX8BuHCP4ac2u2vktFRznZ9kHYYeVGV) |
| 9 | chat | $0.095215 | [`3FW9Ld1qYRZC6Xq1...`](https://solscan.io/tx/3FW9Ld1qYRZC6Xq1DygRJbeW2gsxoJw3LqLaNH7qPPmd7AnaE3gN66nVMCfWEgjhf5gQcuDGwQfz6ncLgDm6fMNp) |
| 9 | image | $0.019043 | [`ra6deYHaxDmsY51a...`](https://solscan.io/tx/ra6deYHaxDmsY51auvsSTNMMkgfK1EuT9bWZGC8wk2pTFkr8Hp3bgnn4ge8h3Pmt1Wwpyb81rLZFDmGwDrEBgec) |
| 9 | image | $0.019043 | [`4wM3DfUH1W99jWZs...`](https://solscan.io/tx/4wM3DfUH1W99jWZsjt6snuWH3rAC4XjjhNBHK48cNxHWtMmGe5uoHVxP83dU38dz7vB7DAPg9eiXpd38UjWyXF8c) |
| 9 | video | $0.104736 | [`4AdczkHiqLVTiqAp...`](https://solscan.io/tx/4AdczkHiqLVTiqApXEZ4hciJr8tp6pWXwPgcw2yVMGN9nKp4UqyEnFR9NsKURX4tkoVriv2Jpp3M8dddm4XEzsSX) |
| 10 | chat | $0.095215 | [`4xGxWAGRm9N3uuvN...`](https://solscan.io/tx/4xGxWAGRm9N3uuvNSjVoUjHdKQcAt98phVi1q8jmiSsekyFA8T46627DNEtw3Q4kCjDAuaiNt1VWyJJC7DNasR8S) |
| 10 | chat | $0.095215 | [`SSN5wJyqGCgaj3p8...`](https://solscan.io/tx/SSN5wJyqGCgaj3p8NSBFPhTXzf6XciqXiE2nbwp3RTmSqUASvKFtkf4TyuE9W9LudNx2bgqHBACDSSHmNVaRPe5) |
| 10 | image | $0.019043 | [`3Sz5aVFz1cx29AMB...`](https://solscan.io/tx/3Sz5aVFz1cx29AMBdK8NYCTgEyt7NbxGWrs2ZVfEW1tAZEoiDvYDrVNCUxh1akWvmWRW9XK8ZtCXvEw3oTE47H5Z) |
| 10 | image | $0.019043 | [`3oJh2TxgSAC2yttY...`](https://solscan.io/tx/3oJh2TxgSAC2yttYZ5HT4HQ8TNXuRZKoGefMpaCYTJSGSewN6d39e86eVSpuASSjPi7gqrRi2hrvY8cZas8AASAU) |
| 10 | video | $0.104736 | [`5qAQCxHZDxShWg4d...`](https://solscan.io/tx/5qAQCxHZDxShWg4dJDjyp6BY6GKHaQ5tyjrfKkcMsFMEg6UTHFSZ3VmsAJAyYTSGUfLHAksvtjQXeEKT2mn35xgV) |
| 11 | chat | $0.095215 | [`45wRVhXkDcyiodYj...`](https://solscan.io/tx/45wRVhXkDcyiodYjRX1KfL5MXT7ypsnkBQ1JLKP8VhucEqC94udnVpth4sDFrcgiGy7e6d5jEmcndUhx1q6R3i6t) |
| 11 | chat | $0.095215 | [`38w9ARF5xA5Hk1qU...`](https://solscan.io/tx/38w9ARF5xA5Hk1qUPMKR67P27vZGv19inJR1VFZ8LM5bsyKiyiCbcqDE9fykXM2BwW6Gc4CCBfBZmRmvEVkGHxx1) |
| 11 | image | $0.019043 | [`X5CMckQevQRwg1PH...`](https://solscan.io/tx/X5CMckQevQRwg1PHUsWGDvLQ2eLNTXEJaB8ER3kdZxBwwV5WNoQTctqEDSJDTR6GpkysEKDLcXttHGUFAhLERvt) |
| 11 | video | $0.104736 | [`56Hf5GZ6WqbPQ7qB...`](https://solscan.io/tx/56Hf5GZ6WqbPQ7qBe4WaU5L5yyhXjBvLTZARVX8UzDk1WLWnQy7XVfTZcAgvMiVwnbsowyMZmgh2PdCNXAxrVHMo) |
| 12 | chat | $0.095215 | [`3U2HHBFzJxjtoqV8...`](https://solscan.io/tx/3U2HHBFzJxjtoqV883guMnmbuMcDU45kJpnrh8pHNHBiUNSV6TTYZ2Y9toHMp5NPzUd4hJpPCPXtUkimkDqLjdSA) |
| 12 | image | $0.019043 | [`3rBCWK8b1wznwDKa...`](https://solscan.io/tx/3rBCWK8b1wznwDKaoLqmU5PwLDhz8m4J7NMtQLbizz3FNr1x9mai8uN5PWtdZggZj83Y1BQGYbvxqjvYKR4qh438) |
| 12 | video | $0.104736 | [`5FMMTpEPgjDtDW7p...`](https://solscan.io/tx/5FMMTpEPgjDtDW7peT5WMxjq7aeuLe31tzXkHHofMbxBypre1ppX8kyPtaxA9XZ1Lkd3fWbsx1EBHoWJ7zNQMEFP) |
| 13 | chat | $0.095215 | [`29rUnUYFsNrwSrcp...`](https://solscan.io/tx/29rUnUYFsNrwSrcp5Kqrgg9ttXCX29FWCdK7Vp2QhdKST62qN9ozpBMDa7CxQjH8EZPshEr6EifaKo4hRwspeaJK) |
| 13 | image | $0.019043 | [`3PRq31Za3eqgtSmu...`](https://solscan.io/tx/3PRq31Za3eqgtSmuM9n3CuZz5XrUWYQbX9hR96ZCsXTnxYjaBJBWf6C5zKFAsvxifa92ijTdM4yuzkZAsk91XaqU) |
| 13 | video | $0.104736 | [`3gvJR6J66evGGLDb...`](https://solscan.io/tx/3gvJR6J66evGGLDbRhPz5yCXqDvQxf2cRPNWoU7Buh3uUyY92yffG7pZUBHujmsa1AunbW93GFMwRGMp3xY7ksST) |
| 14 | chat | $0.095215 | [`2pS3rRZNnGHG5foi...`](https://solscan.io/tx/2pS3rRZNnGHG5foiiUkL9W9veof1R55qhrp3HmeqvbV1eatUuyWrPxfy5QyXdkzGsv9CpbDvBVW566bPUGk2g8Hd) |
| 14 | image | $0.019043 | [`3Ni9vcbZgKyxRQTh...`](https://solscan.io/tx/3Ni9vcbZgKyxRQTh3AoUBXH53VJc9m68vSUHpxq2zkLRTqNcT41x3oRZiBa7ERMbUc2aMQRBTvSSpGfuNaHRsjTd) |
| 14 | video | $0.104736 | [`4R5MbpsY6iUhyk67...`](https://solscan.io/tx/4R5MbpsY6iUhyk67jXZ2zico9zyz48i6rm5YjZHkhrVv347WSuwjLWA5q8FM67cNsZ9e46UcKnzrm1XWG8uJvx21) |
| 15 | chat | $0.095215 | [`3Pi8MD9Ze9QS7r1C...`](https://solscan.io/tx/3Pi8MD9Ze9QS7r1CmYsKMtP2RLzhENyrg3xVBZFDPEgpg7JN63sZbEjD51pNwgGZYU5ie76LJj5D56boCkPsCmzK) |
| 15 | image | $0.019043 | [`4TTkRTQ1yEWHA1dQ...`](https://solscan.io/tx/4TTkRTQ1yEWHA1dQRowaP4XxUiifHNeVJybYtZMeuM4UVcM7SPZJEhYWgbsLeFGkcQJTH2jRjkdAH3C5aADUnvRh) |
| 15 | video | $0.104736 | [`3xixXXYGBgtQRVSV...`](https://solscan.io/tx/3xixXXYGBgtQRVSVU9VvwT4QYRU7HyjKp4r4UcMS6JySQuS1J3HoJqcoWaAMTT6fLoX6mDdb45rNvpD4pmHJqqmy) |
| 16 | chat | $0.095215 | [`3HKWkMkUDKBsE65V...`](https://solscan.io/tx/3HKWkMkUDKBsE65V9XBhCfeFKnzxpH4urZDbE1pbT7z3emtbVwP1peC6XarmGXvn3vBfJcNvQzpHtLqCa7EGtQHV) |
| 16 | image | $0.019043 | [`3zZFL3yDJf1u8oLp...`](https://solscan.io/tx/3zZFL3yDJf1u8oLpChhVUidyGRnuU6zZbJx1Q8pnpiYwBzu1ii8x149xQ4uFoCSkgh4Z7dox5i517J21ZzvNiQD1) |
| 16 | video | $0.104736 | [`4VAJJR7YgVJiExA2...`](https://solscan.io/tx/4VAJJR7YgVJiExA2JyaT8NwwgYbfkTCu7yrjyffnyXm5bmMZArEMG3Bp5MpfF6y3NrY2EHagiqjb72jRSzhw7HMs) |
| 17 | chat | $0.095215 | [`3zTJxb9ZQfFk9fVS...`](https://solscan.io/tx/3zTJxb9ZQfFk9fVSBRgCFYAS5nYktU1258tRTPrdz1QVuP4wFV6ViE3MR4XoHS9K5tHcnuvjaCe8iqFuz8TsGM1y) |
| 17 | video | $0.104736 | [`49M41ueEtmW49PTi...`](https://solscan.io/tx/49M41ueEtmW49PTiU6DSPEi5BWhZzmWoQHbp46jjNj2HoYDkGr56g3srH2cmPMm3fznZ95cWa48RRsLNnthkfwoi) |
| 18 | chat | $0.095215 | [`4aZUho6ySSqbrXzf...`](https://solscan.io/tx/4aZUho6ySSqbrXzfi7GyinGJbPr81oqoYcV3NnNYQuCMGvXZbsMWDznTPGJXb5h5xUMhDncbkAbJfCSFJKmV1qA4) |
| 18 | image | $0.019043 | [`5n7QicmSrtGt6Jeg...`](https://solscan.io/tx/5n7QicmSrtGt6JegVxyyCxokg3ryTSs87xCM7HRVu2MByeQosDqtMiFsCHUBsm81JETST1ReBE64m4p7hGXxxh9A) |
| 18 | video | $0.104736 | [`Xt2p245smPytfzu6...`](https://solscan.io/tx/Xt2p245smPytfzu6wRykR92w2KXyMydEDfyfZh7DFNAw2am3V4wfenkcTbNbyuH84mbT6xomoLmh8AY4tDFfGZa) |
| 19 | chat | $0.095215 | [`4zTRvpfMcGf7mXV9...`](https://solscan.io/tx/4zTRvpfMcGf7mXV9J7ncZhtEpygG7N8qBP42zufQ9iTZtvzmXReJAihEdT9x9SZN7Z1YdoZTRjEX51Up4qJRp5iu) |
| 19 | video | $0.104736 | [`3zSNwS13azUMcRDn...`](https://solscan.io/tx/3zSNwS13azUMcRDnURg3M1rNz9uMrVe8sLCxbVNmBqWdgmh8Djh8mWgP973tbuz7R5roKPi4wAuwghi4MoKp3YfC) |
| 20 | chat | $0.095215 | [`4rq3ec92Fnom9VnN...`](https://solscan.io/tx/4rq3ec92Fnom9VnNdUrMnAkjPGTEw1jvmBcS7RCB8NvyYSNJRRWUmwp7Zs9CFcaZhci7ZBE2Q5Uzm5QaTFK4FeHE) |
| 20 | image | $0.019043 | [`5ZdaV8gP16MvmAtz...`](https://solscan.io/tx/5ZdaV8gP16MvmAtzesFFPAEK2hBkesS1NkBvo8SD6KGUb9WNzsodWGZSR614fPoPYL8WiaXdhLxyQXqYbEkH9oYr) |
| 20 | video | $0.104736 | [`PrX8MQzJdU4hfoTg...`](https://solscan.io/tx/PrX8MQzJdU4hfoTgR2afim1Mde1gdbrzGqMhGMfZHZjFcwbc27XUSa6LC85iWxJgNxfJu1DahKwcyH7fxJHpbxF) |
| 21 | chat | $0.095215 | [`4D11dxT5Wzf4pC7X...`](https://solscan.io/tx/4D11dxT5Wzf4pC7XDTmx8JjdX7n3Le7MWZRAwpZDsX6bxuABecqzacyhx6L2xa9T412yYBbk8jnKko8q9T1ju3Lq) |
| 21 | image | $0.019043 | [`4JhjVyG47kFKCWQb...`](https://solscan.io/tx/4JhjVyG47kFKCWQbkaKJmJCSNK7ZCA1V9osf7SXtrBiCC4r7ipaPXn2Y3exybyUxxvr9UBjVXnxN2HfwPDPBJ6nU) |
| 21 | video | $0.104736 | [`5gfvZWwRRrXq2kTq...`](https://solscan.io/tx/5gfvZWwRRrXq2kTqi7Gx4deqyUYLLRmWPo6rHeNwYEDbiVZhbMcb86VFAnnkSXDvSsedT28UkXJtdRmGgZRk5qoE) |
| 22 | chat | $0.095215 | [`2aapyk2d15X9dj3m...`](https://solscan.io/tx/2aapyk2d15X9dj3m4K73oZfP8aBT9sJ3EXUhHxxhxX1tuuxBqZdpJHKCKwvQd9GsSuf4yzdtUSqfhdddaC1mF199) |
| 22 | image | $0.019043 | [`521YU8jGcudUHsuh...`](https://solscan.io/tx/521YU8jGcudUHsuhvvCrRM2QbDtSvqVXKdGqRP3PcnEoArVi3F5sftx5eR3WWagERwsgmVqUpAuTAHKFanTKFGCa) |
| 22 | video | $0.104736 | [`5XqFFDbytRzqbN33...`](https://solscan.io/tx/5XqFFDbytRzqbN33ZL2BLT9HYmxVXkwGmoidLePNau1a1eQ3ZQpNHkh27qzGLVjWVhoT8xvwjqWfJexLYZt2pz6Y) |
| 23 | chat | $0.095215 | [`2QXTcJ5tcaK4rmaX...`](https://solscan.io/tx/2QXTcJ5tcaK4rmaX7tB3q2Re5teUS5QkqbLA21oVvmbTR2u8bthgm24RibqLgs4j6kb4EK4dtExZc5V69ji6ua8z) |
| 23 | image | $0.019043 | [`42o3YiUGtmrJnWRY...`](https://solscan.io/tx/42o3YiUGtmrJnWRYxw8HPvA5mogB9JS4WMNi7PqX8MJz8uPmoBK5DZLi45A92XX94XoUHHXHUAjXhZXh2ggaipLA) |
| 23 | video | $0.104736 | [`4LXVf4HeaL6ZCHpj...`](https://solscan.io/tx/4LXVf4HeaL6ZCHpjzLJJKDdRyYRkxhnaVZVBzNTdxK3c5mhpLAo1kjt2M4gwnn85yLbyUDPiz9tkXwH5JRHxY3Xj) |
| 24 | chat | $0.095215 | [`28om2HCa17o6KhZ6...`](https://solscan.io/tx/28om2HCa17o6KhZ63VtChcbx5ggjgpy6b9vLsjF8wE6h6vELRiLVtVDLMY9AwNmcNnbr2jVfVB4zph2EEoL6EW8k) |
| 24 | image | $0.019043 | [`25tRt7ZMTFgxhK2B...`](https://solscan.io/tx/25tRt7ZMTFgxhK2BF7VhP2A91FhaoyJ7KPkyiUZ6vT3DT4G1YtVtcM93c5sv4MHBR9rrNWf3HEtdGTiu8bGaswhd) |
| 24 | video | $0.104736 | [`3cDwryLpu9jf1GFX...`](https://solscan.io/tx/3cDwryLpu9jf1GFXMf2ofRvFKA1WxTZHM8iYbUW58AP4uSXoTJzZScb4YU9bSMcn3HAdeYdHtViAako2jgTMJTeG) |
| 25 | chat | $0.095215 | [`5KkwvLnJ87wS5iPB...`](https://solscan.io/tx/5KkwvLnJ87wS5iPB4s21VXd7yXYSwB553uY3p5h87RDnxqWYug9uh6apuxjMt7CnmxqfcFmYCC6vcjj1bKgjiuX4) |
| 25 | image | $0.019043 | [`2GfoPNueuXjPQN8K...`](https://solscan.io/tx/2GfoPNueuXjPQN8KMNuD5k98LuqAi9scwKPrj2o2vqeCd261oaUnDSbxANTzbcsUTDhiHfpA4SaX2zqJSB7dEUPu) |
| 25 | video | $0.104736 | [`3VjDDfwBZniiA22H...`](https://solscan.io/tx/3VjDDfwBZniiA22HUjoUN2b4DFBwy8hjx3bzkmcvGoYcthWrRoik3i9Htc1APdttoUjnKnWwHYFqb2qLUa94sqGi) |
| 26 | chat | $0.095215 | [`5RKXdwEACivE4rNj...`](https://solscan.io/tx/5RKXdwEACivE4rNjkq58kj4aHxFEuRf3MZUo26UASfaMNUdBcDpFRzHHvsHgwFELbLjpXCxtQSKTexoup5tKVDx6) |
| 26 | image | $0.019043 | [`39kuxpHXT6pdur3A...`](https://solscan.io/tx/39kuxpHXT6pdur3AX5v6VBCetuiQNxwEBnnbvc3sZAh99BeiDP7vevcqSEkLqBguDBpA9iowa2aiPqUapfbCU56j) |
| 26 | video | $0.104736 | [`VWi4jLnRNa31Qrta...`](https://solscan.io/tx/VWi4jLnRNa31QrtayUyBbGnyLGgLGaJGoh4PyyNXvPwH5qG8gWZNsxqG6aCbLaPUFjsai5AjvX6ych3nuGES17E) |
| 27 | chat | $0.095215 | [`iWmSQoqF4jhYGZxf...`](https://solscan.io/tx/iWmSQoqF4jhYGZxfSzxPoh1jjARUm6sUfzMrfFvrhSNMyYdZbwCCXHiM69pQ9m61FjSzB9ME5TTqbnCnHhdPfRF) |
| 27 | chat | $0.095215 | [`3eBsxBz2ak5kRbyF...`](https://solscan.io/tx/3eBsxBz2ak5kRbyFYRtFRegQhLvTsoHxR5hHgFCBtrx3tx25ZihEWLypZxbKLegny17GhjpAoniXQmhkDkNRJnMf) |
| 27 | image | $0.019043 | [`3efdJ77R1jXdrG5p...`](https://solscan.io/tx/3efdJ77R1jXdrG5pJxuhWL8MmjSt7DvZdbCajg2HZ6XSVF4tLud6M9ot4KGmVFm9VskTko4EqVzNLMmMo5tdp8oe) |
| 27 | image | $0.019043 | [`2VLmfYZE98FkakUW...`](https://solscan.io/tx/2VLmfYZE98FkakUWPkavGeCqUjw4awri4PvwoGoakZ5S76j7d6W1ZKGymt35iouvM5Bn85FUegXfiNZJcxJYh5wd) |
| 27 | video | $0.104736 | [`mXLArDL6DU5hfsWb...`](https://solscan.io/tx/mXLArDL6DU5hfsWbdqM6qtesV79wrAdpWhQMg2Yb3UwKsaz3qgNAB4ki3fPMjLKV8MjNpazTdj5WfcgZxPv744h) |
| 28 | chat | $0.095215 | [`3AR4Kw9agHiJhyWG...`](https://solscan.io/tx/3AR4Kw9agHiJhyWGGsubEibf98uVKu59W7WHs91XLBWP1NZEiYULm53jb2i22QArDsNU8iNZD6uebBCdX1xfBVWv) |
| 28 | chat | $0.095215 | [`2QNpsdZFuZGKkgj1...`](https://solscan.io/tx/2QNpsdZFuZGKkgj1fSzzQLAjNA2NnJr3rhuLLv8S3tBnFFP3pozdVbL6yeAKoSJNLYj7dosmpu9ZXLCKfxbp8RjU) |
| 28 | image | $0.019043 | [`5uodjh8W82xYvKi9...`](https://solscan.io/tx/5uodjh8W82xYvKi9dx2kRRHMr5WZ72bDEErPqy1HQmQEghJTq4DtDxAAt4wY1RqGmRzhMfF8fNuANKqEs4AfLHmX) |
| 28 | image | $0.019043 | [`5tFg7Nez3AMesXtJ...`](https://solscan.io/tx/5tFg7Nez3AMesXtJqASFE1BMMYF8SRu37jxrPS5A5szyoWA8T2n27gsv7juUy1dGzv59Wvpwwcx4j9RVYyXqireM) |
| 28 | video | $0.104736 | [`2jZpYDshoCfN4Lsu...`](https://solscan.io/tx/2jZpYDshoCfN4Lsuu7uiEz12VPWgcn5nYDsXS8sqsv1rHJSsEdkNfRcL6RPq4TJEsdBDh5GRoeEkAdKBPgZ6qyGv) |
| 29 | chat | $0.095215 | [`5GSnk2FREFSGcJeM...`](https://solscan.io/tx/5GSnk2FREFSGcJeML7TjHfsDMaUwodoS1cWdBayrbR2UrwAoWesNpYvcUdoTDMYi36xp6jzxsLXmEnf8ZQBfAkvj) |
| 29 | chat | $0.095215 | [`3Yjsj7HzQm4Mv42c...`](https://solscan.io/tx/3Yjsj7HzQm4Mv42cK3K5af8TPco9MAzNyURvKkFRGrsJacP7paHZ6uZcDqvPWLfm1F245xDCkakBUSfxthL2Kamt) |
| 29 | image | $0.019043 | [`cGJPu8HNvhF9Gq1m...`](https://solscan.io/tx/cGJPu8HNvhF9Gq1mf4EeKuUCFm2suqJXmnwn1i2F5hMi8RSep9totv8b1z2nDJXVaDrsk7THaQ9VPaECdhh6b7U) |
| 29 | image | $0.019043 | [`sueX2ak1PT2Ph9Dr...`](https://solscan.io/tx/sueX2ak1PT2Ph9DrFL4LxvxVS2drumg7GXMkiQcn6X3EBa6FU2cFx8TU8L5dxghBw6xi2AtPJT1VrDUm83y2XYT) |
| 29 | video | $0.104736 | [`5epSFYboWyXF8ibp...`](https://solscan.io/tx/5epSFYboWyXF8ibp3s5kSYaqKMLVsiry58U7WKBsKmZBJPBuAQMWghvEvkfYRFjkLL1H9U5eDqffgb8E53posTba) |
| 30 | chat | $0.095215 | [`2yfNupLpMSawDLb6...`](https://solscan.io/tx/2yfNupLpMSawDLb6VA4pzrpV6sLRU41KQnTR5iG1kNNtDRJEc24BctyrUTrx7U7h7nfSyDzgkgi2bquuybG3kgX4) |
| 30 | chat | $0.095215 | [`4vVcCfFCopxuC8kP...`](https://solscan.io/tx/4vVcCfFCopxuC8kPniRWJCdLygcvfCUVmBp1U1k1nyg1kFwTrS4hQXG9cWwUf9hCBUCzArCu6sgTBk75PAWPLpCx) |
| 30 | image | $0.019043 | [`2bSCUvpVoVt14bfb...`](https://solscan.io/tx/2bSCUvpVoVt14bfb5DkfvsTAutLjkvAhmhHyMXXdSCG3DU3xovK3AkkryZEE4CpC7oVYxq1YF8gwbt3JAiKQjxwM) |
| 30 | image | $0.019043 | [`4QX2GxQMapLPjaAm...`](https://solscan.io/tx/4QX2GxQMapLPjaAmYDPrSUmi8H13FT67Qo2hHCam3pc3x6JacMXjXat2Na4qN6A3Po7xu7smfzM7g8We1ynDtfkU) |
| 30 | video | $0.104736 | [`398iKsryWEyLHxhe...`](https://solscan.io/tx/398iKsryWEyLHxheUEjG9Fh7KLs9iBc2DYomaitUVTPG4bCreN82Ejt9k22dJPUvHpg3VofRtvHKWsYT2xYyzVEV) |
| 31 | chat | $0.095215 | [`WcQaTboq28QD2nLJ...`](https://solscan.io/tx/WcQaTboq28QD2nLJk8YhMQE5cC1c8T9RNSXjv74A7VmF8Sg1dcx4cU8Ky3zLHAp7VWxMQzyLRSuAgvDgvuBtQ5D) |
| 31 | chat | $0.095215 | [`5WyBELRsFtyVJEhL...`](https://solscan.io/tx/5WyBELRsFtyVJEhLXC2um5UJbKGXCuZC8xypFSUSPsk574zhurC9dkYUFUwaFbFQ3upzHXrfmnvmDWdYYEkD6BRA) |
| 31 | image | $0.019043 | [`3TtiPjVoPL8gPPKp...`](https://solscan.io/tx/3TtiPjVoPL8gPPKp5cydtrhvEBB1x58bLXHM19ZDMN23jbdkvVwf8gsb4UumBiumMDJSkSpSjjajoQzcqtbS8mUJ) |
| 31 | image | $0.019043 | [`3p9HELy6N2sEY7cb...`](https://solscan.io/tx/3p9HELy6N2sEY7cbShCLw2u3mS16XmButYYVKq7NRQne8e7k7EkkGjT6Do4V1iaBuztKQiPjnA2CKyF1U9jov3Si) |
| 31 | video | $0.104736 | [`64XG89u5RaX9mP93...`](https://solscan.io/tx/64XG89u5RaX9mP93Q3oD4qGuetS92KLnpbxxXd6WqBVgGC6gQ61HEmeCcD68qhFzCCjE38MZmWrt9CmeU24oPq6q) |
| 32 | chat | $0.095215 | [`5UhBgrF7w2XcvjoQ...`](https://solscan.io/tx/5UhBgrF7w2XcvjoQhKcHbL44r7hqzCfwz1oo6f7Q8R1nik424Eeoi5qETCtmnj91FXwWy7hL8zv8yN54XH891PJx) |
| 32 | chat | $0.095215 | [`PCqnt9YU6oVsNhnp...`](https://solscan.io/tx/PCqnt9YU6oVsNhnpcECSDYpsE4SgRbZzxY6macJM23tPkqk61k5zMfGfMHeNjP7d8K5ZEcZhPM6vysbgWwRvgdV) |
| 32 | image | $0.019043 | [`5Bz7XK9azjFo1qtz...`](https://solscan.io/tx/5Bz7XK9azjFo1qtzpaLw7AoWVmk7pDD6kNSpmRCXWRfgqVibDqHADQubMV3u6u88KSsFcuDWbM8NPTtNebSRCWAL) |
| 32 | video | $0.104736 | [`5WST1REoD7eqsCw8...`](https://solscan.io/tx/5WST1REoD7eqsCw8ECFHeYZb81NQ5cwRXA7Kzgb1UrHH1EpG5cBnLaebWNtFsj6vS6bp22aqZqBmetwR99sHVGFS) |
| 33 | chat | $0.095215 | [`2FEXRNyo9Q9TB4Cz...`](https://solscan.io/tx/2FEXRNyo9Q9TB4CzopkRoJqbbRGmQP2J5r8Es27ewpKk9U6k7mZrWPiSm4ddeg1cghdbPgvrwsemjgZmHnhMdqr9) |
| 33 | chat | $0.095215 | [`25eUQSswSTa9oEgd...`](https://solscan.io/tx/25eUQSswSTa9oEgdcWCnF5CVBcjRRP6NjxTSE5NDt4xFWg32BoPG2HoZLS6e4Nq4MEYK47Qe75U8thCoJuaXHnKS) |
| 33 | image | $0.019043 | [`2hBArhpTyE78wQiz...`](https://solscan.io/tx/2hBArhpTyE78wQiz77EGtv4sz2UYVNBwXuSdoheaRmj4Lr5sAqH3itE122GS4fja6xvqmdaCbyZux7Qsd5jU3aK9) |
| 33 | image | $0.019043 | [`xBwUk5u3cr9aXkFv...`](https://solscan.io/tx/xBwUk5u3cr9aXkFvf2kQeZpaQ2grgiGPmS5haEjujoL2oWScUkwR6vVE1A9ornxnc1tELACfhANJuSjEH9sRg68) |
| 33 | video | $0.104736 | [`4LRheRiUHxheFLQY...`](https://solscan.io/tx/4LRheRiUHxheFLQY6MJfAf4kMTSTM4A6TTtgqVoBhRtV7Mh34tJnFN3QNurJuh1fP1jt1yfwQ8dEns3dVdgQzAPK) |
| 34 | chat | $0.095215 | [`4hBL7eMQW4pmJkun...`](https://solscan.io/tx/4hBL7eMQW4pmJkunTCsVpo1KHt7AHG3YFtj98Y3mFQrT538ad4sDuuej4dsHZmEbWZ3STCewkyFpJMJXCdnX3E7) |
| 34 | chat | $0.095215 | [`3EaqYiXmHMCgJYLR...`](https://solscan.io/tx/3EaqYiXmHMCgJYLRqtikBaRGVF73g7HW6yrKAimiosnZxmZMKprdoPAkYVprv6W6QjbzM1uCUrmFGKvoCzvBvhH4) |
| 34 | image | $0.019043 | [`3BMrqaLV7ZXNSUPY...`](https://solscan.io/tx/3BMrqaLV7ZXNSUPYjqLwsXXzNMHcfuxbpnYdHaWX3tkmcsPMBoD6kghzEurU29Z9RgSz9dfufLVaYQg9SjvAoz1g) |
| 34 | image | $0.019043 | [`4FfBPVYaaDNQdKeS...`](https://solscan.io/tx/4FfBPVYaaDNQdKeSMkYz2D9TG1LUfBW5uWPaQhD1f3yQCMgXvGZRkZMzmZqBEgVa6rPRuS8viXn2tQyaRoMkYseU) |
| 34 | video | $0.104736 | [`RMiskcikKbZ2raTg...`](https://solscan.io/tx/RMiskcikKbZ2raTgdPjHn5C6Go3p3Bm2DihBZNLJw6V3mQ9Hp3noMWjKt21H9aGCHJTBTusfBYPpMu8hMzdXxtr) |
| 35 | chat | $0.095215 | [`HeV3sSevHBE7awhS...`](https://solscan.io/tx/HeV3sSevHBE7awhSrFZMPGb5LukMwh7CbiVkbKTzQaut2YLfRfBGqB3m2FJB4Yiyrjy4LH3TgvZE2kthyLbrroE) |
| 35 | chat | $0.095215 | [`5MQVsW5EeFrHi634...`](https://solscan.io/tx/5MQVsW5EeFrHi634xoTm7PtnSi7cbKmvuncRbmtGLokVufYU1tJtd7YxfR6QrqvAsyGXC2QhpTEtWMm9mBsRzxhN) |
| 35 | image | $0.019043 | [`2unYquyTd73N5PYK...`](https://solscan.io/tx/2unYquyTd73N5PYKT7Sktx1iALYGnmg1L1xMEWvUMrB4mrEUuY8WdYXVSsDwda4vkhV81Dq4mozVUdwJiJKf3bCG) |
| 35 | image | $0.019043 | [`4gG7ChML6PN3MQEW...`](https://solscan.io/tx/4gG7ChML6PN3MQEWeDsV9fg8GjokKBLDfm3bPCQT5hgZEaP6cLLLoPoC7CWvwBtZTvM5pzKcapKfN4URteL5EsAN) |
| 35 | video | $0.104736 | [`5rvsrKU3wSKhyQ84...`](https://solscan.io/tx/5rvsrKU3wSKhyQ84PNoqy1SbJ49i6ok4eE84Cf13nLtd9wpvuoAgS4FL8twcHfkFi7SAJyETFZH3tpptnEXhFNyr) |
| 36 | chat | $0.095215 | [`3BEgiDCBy7hGD7Sh...`](https://solscan.io/tx/3BEgiDCBy7hGD7ShuEQuENctAbm1jN5FbJFNmJaimfbkTPyrLnzzE9wbFVcoNE1vvsg74XH16zSLwSTN71wuVTgn) |
| 36 | chat | $0.095215 | [`4yZAQ4sFqHUUhST9...`](https://solscan.io/tx/4yZAQ4sFqHUUhST9VDbekkL7ypVH5XMBaNG7Psj9nNPy78reEahstN5AjKyDRG2eA9Zqt79nS75Z1cbvGGwv3gz4) |
| 36 | image | $0.019043 | [`WXRRHfEF9GWJXUjP...`](https://solscan.io/tx/WXRRHfEF9GWJXUjP3LbTBFZe2C8GYkfZbMfhAFdssBuW2Xu4Fu8MniSF41HXCCn84RvGEdmUT7HwKCvhCNsgxYn) |
| 36 | image | $0.019043 | [`3GC6dY7VQWQor8Cy...`](https://solscan.io/tx/3GC6dY7VQWQor8CyxmVdjopxUkC1KV1ciremNfKE9VtRG4nrDaJn4ZJK4vn2NYAa3fatqUyNJF8NybZmKk8CHZdJ) |
| 36 | video | $0.104736 | [`3EgMuguM6yavRt5E...`](https://solscan.io/tx/3EgMuguM6yavRt5ET59x5C2MmBCKNLPXg3sTCcvWE5fLmB2VkGW3EduesBjKSzA1XtBGv5a3vrHGbURLtiHkWEYv) |
| 37 | chat | $0.095215 | [`UBmDDVTRcM7AZy7d...`](https://solscan.io/tx/UBmDDVTRcM7AZy7d2y2JQrwscKVrsjFY3RNwzJ4bdcy6cjmDJ1VGmue9BMf1hsouLS2Xc6UJRvXFRpv9GGr95Jf) |
| 37 | chat | $0.095215 | [`4XNXVWbUESwSGDrT...`](https://solscan.io/tx/4XNXVWbUESwSGDrTkhNzYZhAkDsWScQUMrQKmN1emjwh647SdD3JaDWYkNC75UNabWKAzNK8daiQhiTdYtBXBfD2) |
| 37 | image | $0.019043 | [`CJrMYK6SP1LCf2sJ...`](https://solscan.io/tx/CJrMYK6SP1LCf2sJQod1xAfPyifoY1p9myCmzcbBNPUPHeVsFMuosnTQp3tMAYVGiVHWuQmwYJZMoWCzFWxz4cz) |
| 37 | image | $0.019043 | [`4RRYeApS6nfBb4xg...`](https://solscan.io/tx/4RRYeApS6nfBb4xgLnEsKSBsxrVafSrm7cYKHxZQVfVnHe5TjVre9jHLMc5EpQUNp6mirAynDe1bAeJNFG77d1iz) |
| 37 | video | $0.104736 | [`2HrXPFZLfv4Gk2Mg...`](https://solscan.io/tx/2HrXPFZLfv4Gk2MgWsmdfUabKSTL3EHitvNewcSFCwW5nyA84UMCMXzgZXv9Vef22qqSXorjTu8EbPwrDd7yr3fz) |
| 38 | chat | $0.095215 | [`5DS979BxWMpdq2dY...`](https://solscan.io/tx/5DS979BxWMpdq2dYvRRSMJWZkBRhsddcA4dGTb8e8i3S6Ks6yXGSJJWmdKpb3XTMcANXhnxk6ZpLnHcp6CxsyYrB) |
| 38 | chat | $0.095215 | [`2CjTcDkm5rxszjeE...`](https://solscan.io/tx/2CjTcDkm5rxszjeEBa1xNnijXT9xMMRPa5SZrQL3KJdt8bxAsbHh4UF1PmmT7UGN48381G3TWeLChyNSWfATq6jP) |
| 38 | image | $0.019043 | [`23FCcM6pHoCLhrw6...`](https://solscan.io/tx/23FCcM6pHoCLhrw6Cwc9XxS355WtqrfbZnSWmMmNu5DZVHCrS4c9A67dVv58AszAUHtUTbJPoy1ScqAwpGqp9SK3) |
| 38 | video | $0.104736 | [`2rtfvuZr1ZciQHEB...`](https://solscan.io/tx/2rtfvuZr1ZciQHEBbh92hepZZzLkPXvVQp3s1exP1XCTN6XdTJ1VC1ss5De7UNXsJpS6FwTf2tBHpeFRr8NwDzdw) |
| 39 | chat | $0.095215 | [`2bC99jvRunGhgtTM...`](https://solscan.io/tx/2bC99jvRunGhgtTMsBn1U7FDeGaT3Wp5bW6s1Wvivzc91iiSBzKapet7zK7pugkrZb2ppLWSs7zYdzw8nKjFwg5G) |
| 39 | chat | $0.095215 | [`aLiaFMgUNRbE1SjS...`](https://solscan.io/tx/aLiaFMgUNRbE1SjSUJXMawraXEF52n3Ce8zNX6BNLPrpajmgeWbaNGHP5QUBR8CVq1bWPV2pzeUedyWsr2qp1SZ) |
| 39 | image | $0.019043 | [`28C7W4ivCJcMjmfe...`](https://solscan.io/tx/28C7W4ivCJcMjmfeNzL6iGepipQ32QBPSUrjvP3WL9UumhY4xPA5R5Jk8oUUZnPGLQNitm3CbGck3bnrw3m3atoc) |
| 39 | video | $0.104736 | [`2zHqN3mRPfEeJjt9...`](https://solscan.io/tx/2zHqN3mRPfEeJjt91oMSVQvNBKtk3pC9wqaJNxBBUiqrdbJjoG9ZztCiDSEYB2W6pjp5HNboP8Fhn5BZHg2WKPXY) |
| 40 | chat | $0.095215 | [`ETrJorMqszKEKPVH...`](https://solscan.io/tx/ETrJorMqszKEKPVHw9GY75C1ZLdC2Som5kTtKQiCYjstUKNMEWSo2UhfVwFm2dJRczfkbWSSTBtPc3gMiR6aXYF) |
| 40 | chat | $0.095215 | [`5YEme3mJz9Q8MKkU...`](https://solscan.io/tx/5YEme3mJz9Q8MKkU4Rf2c5HUwqiawW6z1ZQGziW9UKKvUV3sW3QGcXs5z5qxcBw5Kg48PTByUJWZgetPHZXPJkKd) |
| 40 | image | $0.019043 | [`2hJqYKE5dRbwkpo5...`](https://solscan.io/tx/2hJqYKE5dRbwkpo5Yb3WwDS6rg1qF8dxDqTytXh9WbjmGditpBcr3mVx1owqqtKG4wG1Cd19nGLkkTbsZ7fWyZHW) |
| 40 | image | $0.019043 | [`3iTH8vnjJvNbFhPG...`](https://solscan.io/tx/3iTH8vnjJvNbFhPGytVq6y3nymZWSB5chJZn1ckgtmW85mahJT7ZTJc5AXDu69RzcetTmv63S5SEyAZK6DHEoo5Z) |
| 40 | video | $0.104736 | [`Sp8omkcVnFiYNqVA...`](https://solscan.io/tx/Sp8omkcVnFiYNqVANj1KLMDf4537s5GBZp2YVCWVpDi7X1W2CztBVtvWPrNLU3A8K7dQ88mwNG5QyUEVsApVZzo) |
| 41 | chat | $0.095215 | [`21ZNmnzGgsdgXJzd...`](https://solscan.io/tx/21ZNmnzGgsdgXJzdvFUAuFQqLevL7zEYt4Ae74tRdVsJxQpJMvNef3qfWmmCXe8THwj8vUZtPPSSYaYFeEvuH5yi) |
| 41 | chat | $0.095215 | [`4PR23goCdSbRBYgi...`](https://solscan.io/tx/4PR23goCdSbRBYgiAcGG6Phiho3HM2wsH33EnMVsxrrEAqij7EVpRZ5yfFsqicpyaxLhWfokBzsBUNbxEccKAKSi) |
| 41 | image | $0.019043 | [`q4m19NJ2Ycgpnz1B...`](https://solscan.io/tx/q4m19NJ2Ycgpnz1B5WRRk723mge4mJRfnr9d2TPmes9wHowsss2VENw9KEKiHTYze1MmNFgjdPHxnPC7Ln8AnTV) |
| 41 | image | $0.019043 | [`4SR95oPkcvPy3J6G...`](https://solscan.io/tx/4SR95oPkcvPy3J6GCvWMpkQk9V6d9D8REi36AzXSBQpuAaZHKhUFVJFiUtUSGc1ozRjevdkRErpa6XVQA87m7xW5) |
| 41 | video | $0.104736 | [`ehS74FCHKP8jFoy2...`](https://solscan.io/tx/ehS74FCHKP8jFoy2mBwBXQw1ZSYVJVaFb4Gc9zAdPm6Huc9giYKooM7fg2tRxJqdbPqPTpiy4jic82i8mCpe2kH) |
| 42 | chat | $0.095215 | [`3f6f6iRGDrhwWLX5...`](https://solscan.io/tx/3f6f6iRGDrhwWLX5e4t9DBAB5sHMsevZwKhHoWN5eMUQ7t34PiBgtt7bCdkVYZNqP9wX6rWbRfCQEiTqVM1D4os6) |
| 42 | chat | $0.095215 | [`34wJAuEK489uqabB...`](https://solscan.io/tx/34wJAuEK489uqabBzmmPcgK1Nu7A1eGDszZu81ejhbQPt6WgV9k5jQiz8FyVVx5A2jbfgLnRTCr3o7DJJkfaYxQu) |
| 42 | image | $0.019043 | [`4mUcGMQyx1beAKxu...`](https://solscan.io/tx/4mUcGMQyx1beAKxuSNeayLVuWEP4iqrMdJkXBFjMMBMAgzDwgCPYBMg4xGkKQ9PD2yHwV4LP8ZemGDhPdHtUqQMu) |
| 42 | video | $0.104736 | [`hAAv4Dmk4csS8J7V...`](https://solscan.io/tx/hAAv4Dmk4csS8J7VKJnsPudJgbGr93xjt33vRWmYb5GuvNqbVbzJYkH1jzQUrAyxZFk7NkLFoxYihBoNFdNWctz) |
| 43 | chat | $0.095215 | [`UFtRU4WuK9t2NGUZ...`](https://solscan.io/tx/UFtRU4WuK9t2NGUZvvhWtrQuUUcz8Cx6gSSYvJiuuaeeMwobMaBXfvwi176QfytELaNC9TPcmE5iHzzxj5eRjCF) |
| 43 | chat | $0.095215 | [`5aaiLjFttsuBKSnX...`](https://solscan.io/tx/5aaiLjFttsuBKSnXj6yqPqLFfszi4LLm17wphB5i4Utgha61DZXxdPLYZWKVSLNnJGNsGeS53icTcn8LMGm4ADRF) |
| 43 | image | $0.019043 | [`41FtUaQoiQ8MN56Z...`](https://solscan.io/tx/41FtUaQoiQ8MN56ZatezYEeYywzc4eKvNYHKcRTgw5BuhjyCAUe8FqCxZCQAcFEbjLSuLfJAL4DTDPx5w4D9JMkG) |
| 43 | image | $0.019043 | [`5VEB65Q2vPg6K81p...`](https://solscan.io/tx/5VEB65Q2vPg6K81p9kKhJMYR2cpLcNqYQV2wRAQKjn9CV3dixdQz7z1BUuv7kpGw6pM3VCiBXmxtPSrc9BRBf299) |
| 43 | video | $0.104736 | [`4BcjbqGaZTNeo7Lu...`](https://solscan.io/tx/4BcjbqGaZTNeo7LufSvJxqspy2kUdYTAfXKpUvM7btcpxn2nqjkDrx2SW7g4WLNsVqi1NNbKiRC87natyJ7zTzQv) |
| 44 | chat | $0.095215 | [`4ESGeoLpBWLEymgb...`](https://solscan.io/tx/4ESGeoLpBWLEymgbicUXJuJocCsNY5kbQoVYNxbRxZEmTw4TaAMp4H4TWYk5hz4Vtm16FkQH3f99Abs5VyL3esPx) |
| 44 | chat | $0.095215 | [`eqix5oxtu5wR8FAg...`](https://solscan.io/tx/eqix5oxtu5wR8FAgJKSfXaYQ74nvXDoKCCSkrhzJPAtRYi3agQ1iVtwJFWrxTQWaH1Khef2hAKY3Y8zPfNNmci4) |
| 44 | image | $0.019043 | [`4pSEngjfSEaJEd2v...`](https://solscan.io/tx/4pSEngjfSEaJEd2vUWxPLSBA8ZNM4DXhykXL8gbML2ELG87UJpDXhjV6Sfjv9vLEvz4MujSyshsvycVMVRgLbpVx) |
| 44 | image | $0.019043 | [`2kcUub2GW2xHRSKh...`](https://solscan.io/tx/2kcUub2GW2xHRSKhcw4M5r2BdixPfUUYanXgm8j2ZnvmAp8ucYnvKtSfcunbxdDMFeSrctwaBvVx837UnY2Fu6Lb) |
| 44 | video | $0.104736 | [`LNudHmLFEiH1NEaC...`](https://solscan.io/tx/LNudHmLFEiH1NEaCUe1yjeGS5PPe2kZZunePtw6qFJrxceUB2D9whKVtXzp1P4vGweLsPwS9xXtA19deCs6XDNG) |
| 45 | chat | $0.095215 | [`2Uxy8xLhP8sRzx9B...`](https://solscan.io/tx/2Uxy8xLhP8sRzx9BwSPnFMEdrukRxNjCVzRZbvoKAQzzm4aCy7cXGumFHMeTe4K2bQf6Wpa524tSusvo3jiNrirE) |
| 45 | chat | $0.095215 | [`4gvqDRU4ZhdCemmR...`](https://solscan.io/tx/4gvqDRU4ZhdCemmRHXWAt738gerv7pWdzWH5BaW1jGJiu3QQU5RpXzxLea4jSMKRr6d7xjvbwNobzJnL25xwYACq) |
| 45 | image | $0.019043 | [`4M7sL1DePnWU1eBw...`](https://solscan.io/tx/4M7sL1DePnWU1eBwHjoE9ubAXxVJSvgNRjqmCvJsuxrUbTneBMnuCA445Swphv4uRb11Wkux8EkffHPKjt15qroy) |
| 45 | image | $0.019043 | [`4cKQBUzGTYyzBJqd...`](https://solscan.io/tx/4cKQBUzGTYyzBJqdPNviNhvu3yrkGm18bt6kLnKqLxm6avkpTkCHTzJo2TUMBb42o9U7fobZeHbLc1Xhk1YSy8J5) |
| 45 | video | $0.104736 | [`5QAGJc11mTijC3Bf...`](https://solscan.io/tx/5QAGJc11mTijC3BfMT84meNEkT89ZN7VZtZeE9VxMGQDpj12yoJTrZrjpZH2bpM16UDAcQF8wUnp2C1E42Bg82Qn) |
| 46 | chat | $0.095215 | [`2nc4qyqzkxbGByzP...`](https://solscan.io/tx/2nc4qyqzkxbGByzP5NYeq9UH96F7miMXHU1nbpJiLA4VqtU1M7jxEZGoPzufAh3djahMafo2PpLXNe8zq4g2xc6k) |
| 46 | chat | $0.095215 | [`255AZceHcGyQTLT9...`](https://solscan.io/tx/255AZceHcGyQTLT93cEyYTWx2d7CKdyP63Nq6oAnCEvMuznzHej2dmPUASjBk841xfhnrj14qBymucMtLtYJUpVm) |
| 46 | image | $0.019043 | [`4BDHyWjDMiwZ6sPe...`](https://solscan.io/tx/4BDHyWjDMiwZ6sPePkNtDAKp8XkfGB8hR6ZVDLbFBDZpMoQuqi39WTid1ksFoSouTJPnaSg3jFVuaGsEbhoSHWYV) |
| 46 | image | $0.019043 | [`2x7nvBfvntYcuZz2...`](https://solscan.io/tx/2x7nvBfvntYcuZz25URjgSa2kFGvBRGXm2xDpt4xY14HVyhjtanp4abU2FZENRbCyezhVCKmcU7j4rf79wKgzeMu) |
| 46 | video | $0.104736 | [`3VnqJUhuXczmbSAK...`](https://solscan.io/tx/3VnqJUhuXczmbSAKjaqMJamsigXJApxqJSx4swocKkCcKZkDPWF3ecdW7mH46mkfpVS9o8vo6azu8y5oxxwSQ8q4) |
| 47 | chat | $0.095215 | [`5bdBVjckicW2uVi9...`](https://solscan.io/tx/5bdBVjckicW2uVi9ZHJMu1L6zRNzrGc2BJ5LnkaFYuhNvk7ezzpvss9FHZ3d7PUeoXzseYvWzNivARixXhkibh3s) |
| 47 | chat | $0.095215 | [`akd6dxN8gXdGitbm...`](https://solscan.io/tx/akd6dxN8gXdGitbmCPSKAEmaqqqiEXRpiwrjyQ25FY9z3rje3V2jtLicwciaXtcThjMmHca8TWqQEA3dJ48FV2W) |
| 47 | image | $0.019043 | [`2SeLWsJUA8KqjGS7...`](https://solscan.io/tx/2SeLWsJUA8KqjGS7ahWqezHinuKEHjwu8y7dTBXP3AwK7Gdta5uYW1ELm6Bqh1do5CDZwaajcjzM6EURSngkuTQt) |
| 47 | image | $0.019043 | [`5tyrjqFFhtmB7oQb...`](https://solscan.io/tx/5tyrjqFFhtmB7oQbsDfd9ctAai2FEGkjefhs4UuKznDrHHorsdG2vBX8geJTS5MCJYHZLLL8EzWckB9bzxrj86k4) |
| 47 | video | $0.104736 | [`2gVACZm2RxauVCJT...`](https://solscan.io/tx/2gVACZm2RxauVCJTfKJv8zbzXs8fCjUhGRx3qVsZjP9P5mWvNWQYYtvHkCVLUrxKCPLquPEJG11JP9o8R93d6vKx) |
| 48 | chat | $0.095215 | [`3t9fGiwSFdPfYCSt...`](https://solscan.io/tx/3t9fGiwSFdPfYCStdSmaDW366zrB1erYAmkbsSy6bPvw1yvXtt4ndPv1HCdQcYtP5nkr2VprJPanHa8Czpr4eLLr) |
| 48 | chat | $0.095215 | [`6BGFnUd3XtPhyNpo...`](https://solscan.io/tx/6BGFnUd3XtPhyNpo9jg1An1XbFF6CHbcLTJP79aNpfhAqE7ueAv8f5iguNV1rpQerLW3UvHvAF1nGAD421p6qpg) |
| 48 | image | $0.019043 | [`2ESfEzgz2UeAwp9C...`](https://solscan.io/tx/2ESfEzgz2UeAwp9C4PPhhPCqFX5YanQe6i6qKSjDvoC4CaskVtS6a1znr7ri6AtRhAyX599dJSANrXwkwSGyc9Uw) |
| 48 | image | $0.019043 | [`3ghobbaQar5MGxrR...`](https://solscan.io/tx/3ghobbaQar5MGxrRJjkJxtPt9wV2bFhvxdwgscsxda2o2aLKzFyN3rEgbdcx97DoKLVqTM2K3tLDgx4AEENN2Y6n) |
| 48 | video | $0.104736 | [`36Be1iVGGSz6MsGk...`](https://solscan.io/tx/36Be1iVGGSz6MsGkiCif3wHjXijxUu8gbktk1n4KPfaUebvHYkxsQXffyu4rdg7wTiaLnWUea5syxD7Pf7bFwApA) |
| 49 | chat | $0.095215 | [`WN8DZswWTtb5sKNC...`](https://solscan.io/tx/WN8DZswWTtb5sKNCjWT2388RAA9UDWEKcCTBWq3LxB3xRpHxnBfMe3WjA4teoN2HwnqiHiNsHZGmXorM6unZLfs) |
| 49 | chat | $0.095215 | [`2LxxPpvD7YbS4uPa...`](https://solscan.io/tx/2LxxPpvD7YbS4uPaZC5JG7dVzgfVkNyKDEUfi7nhAMDtL13hQkRUooWXiBnC5Bgo3UMZFnLg9SUrbHtgqtHNd91s) |
| 49 | video | $0.104736 | [`4kF8dvJvWYRXNs4w...`](https://solscan.io/tx/4kF8dvJvWYRXNs4wd4Y9ooRy45ZizYzRQ28rzhRkckJNej54tfdZWK5n7Sdi2qFdVbgPzoNWgNfY7iBpcpQSZdD9) |
| 50 | chat | $0.095215 | [`4hLpyyqkLwAvTBPy...`](https://solscan.io/tx/4hLpyyqkLwAvTBPy8jpCqVBTNogM4rUgawwEz4rBd1bBtNkdgmbpba2tQBr9avQiT4QiRnGSHpUBifL68kSmMWQ1) |
| 50 | chat | $0.095215 | [`2RdjAH12HbRBM8Bf...`](https://solscan.io/tx/2RdjAH12HbRBM8Bf9Q4qkM8yhyhDtgMiRVG9hpEXaDw9cU7mt6eC8LiuvXX7F6tbRa4k1piHSZgZefjmBSAeKJMc) |
| 50 | image | $0.019043 | [`wHgzkuu2RNNQub13...`](https://solscan.io/tx/wHgzkuu2RNNQub13k36rBNNyDhcghzcSY4kvyPrBB9cdJVv6sUoZckfzuY5dAj32T7HV3jwCspqBdpuKvuZiRCA) |
| 50 | image | $0.019043 | [`23tHSFxfqqpBysUX...`](https://solscan.io/tx/23tHSFxfqqpBysUXQoT2uj3Fe3HwGxZ7tdsfZo9kEvRKC9z5fygHEfW3EhNZXxmw8wYUydxPt3HKJ2op9QMm1AHV) |
| 50 | video | $0.104736 | [`Uh3t4FMhun4RYaJa...`](https://solscan.io/tx/Uh3t4FMhun4RYaJa41VE4tv8dixb9MpHZFGsVG5GDMYG4sRR7ivaGFSKYdaQAvvrtvvnP8UwykaUYd81Cfb9dTz) |

---

## Prior settlements (May 26-31, 2026)

Earlier x402 work — probe scripts, the May 28 live cycle, and the
May 31 paid verification + smoke test cycle. Every signature below is
a real on-chain USDC transfer (the Luma/Hailuo/Pixverse/etc. entries
settled even when the service failed afterward — that's how pre-submit
x402 works: payment first, fulfillment second).

### Live x402 verification — May 31, 2026

| Date | Stage | USDC | Signature | Note |
|---|---|---:|---|---|
| 2026-05-31 | image-flux | $0.022851 | [`GcYZog7kdsbWcrEn...`](https://solscan.io/tx/GcYZog7kdsbWcrEndhGfBLtBkEAXJRjQWAf9WhTTFxFcmX8JgzgafF4TK6Crah8jmCSziAEPKTEv5WC5JRKFxb1) | verify:x402 paid live verification — flux-dev image |

### Live cycle — May 28, 2026

| Date | Stage | USDC | Signature | Note |
|---|---|---:|---|---|
| 2026-05-28 | memo | $0.000000 | [`4NaV1GXgy96XMgKb...`](https://solscan.io/tx/4NaV1GXgy96XMgKbp6gnrEeNzyQ6aYeYDWsjJg7t1Uz63dQr45EpHLJZTPpnDAWGxL3s6rDFeTeYvz77KnDdGBda) | agent receipt memo for $9.9M USDC whale cycle |

### Pre-submit probes — May 29-30, 2026

| Date | Stage | USDC | Signature | Note |
|---|---|---:|---|---|
| 2026-05-29 | chat | $0.095000 | [`4e37dfQFVsfwAHUx...`](https://solscan.io/tx/4e37dfQFVsfwAHUx88BZaES6d4LMZbpLeRedq6DQp2UbmLu4b9T49KxvDczpKqbDDWkfeaBauFm189VzYTx6aMc) | gpt-4o-mini chat probe — proved chat stage on x402 |
| 2026-05-29 | image | $0.019000 | [`4GRJdreKw1GZDqtK...`](https://solscan.io/tx/4GRJdreKw1GZDqtKAeVjPxCg1JqNMW86xPVBi63X1oKxurXhRUaJYsvVzeE5C52icps32LrUYG4TMoW7dK9gHRAi) | DALL-E image probe — proved image stage on x402 |
| 2026-05-30 | video-luma | $0.113000 | [`5R1bksiaMnuPqJsW...`](https://solscan.io/tx/5R1bksiaMnuPqJsWHmEtuav71MKCCX3cxVJNnj6oAKudw53XHtAMKZVLgNQcDf4eahxkABt7ThaT7K6qsPJTAhdK) | Luma — 500 (Doms confirmed Luma is known unstable on x402) |
| 2026-05-30 | video-luma | $0.113000 | [`5yj1XpdiZqMJVtw3...`](https://solscan.io/tx/5yj1XpdiZqMJVtw312MdLwCeMfLGZZoU4pJ1xF1173ospvhRthhKFksy8TX8rSqqqoKDfZYk7iWjN7qVP6nVYAya) | Luma retry — same outcome |
| 2026-05-30 | video-hailuo | $0.164000 | [`4EcX3XNoMGBq1EUC...`](https://solscan.io/tx/4EcX3XNoMGBq1EUCy9rM5GS5v9NoFtkr7ZWAp31vXqfW5pgjhpP3JYZTFne6tEFJg6V41mJuSUF3wPiTiCo3odxq) | Hailuo — 500 'no channel for default group' |
| 2026-05-30 | video-kling | $0.095000 | [`3ow9FGRcFJ1RzjuB...`](https://solscan.io/tx/3ow9FGRcFJ1RzjuBzoB8jnMk252S3pnCb1p6HXpm3rdB5Nc6VQpiBRFjEirfWWwjLY4E9Y8GCoefhAhd72PBiFqZ) | Kling pre-submit — no response from rendering pipeline |
| 2026-05-30 | video-sora | $0.095000 | [`47hz5V4DcqfBDb7B...`](https://solscan.io/tx/47hz5V4DcqfBDb7BmoigCJkHC9xeJpXcEbYwvpT7kRHLtpa9p7WtQDt9m4zVSkqX7yV8SHywzKNZ4wSWG1kex1D2) | Sora /tasks — 200 but empty body |
| 2026-05-30 | video-pixverse | $0.116000 | [`SDsREsiJtdnzVDgn...`](https://solscan.io/tx/SDsREsiJtdnzVDgnULjMLBC54tN4StD4xET9ge1yg1aVyw9tJjxy8GufJQRzVD2CpZQbLeZF78nFrpsQhZSRjUs) | Pixverse — 400 'model required' |
| 2026-05-30 | video-wan | $1.671000 | [`36zLXD69LwzhsmZv...`](https://solscan.io/tx/36zLXD69LwzhsmZv2teCfkbSxasH83GaFcrtj5iwQPPYUXguFUt4b14Nv4pVkZvHvqhZXwwrZJzcY9XXnmjNDUB2) | Wan — 400 'model required' |
| 2026-05-30 | video-kling | $0.095000 | [`2mTLS51UgoCaLnkb...`](https://solscan.io/tx/2mTLS51UgoCaLnkbdhgCbE5vSryg8f8NT1b9DjGg9Ajyg2zLaYXEZtkQ2o2d4zaSYCpLmUcPzAvjv7ymnJYUkewF) | Kling retry with long undici timeout — still no response |
| 2026-05-30 | video-sora | $0.053000 | [`3R1nSWayY37tX5Le...`](https://solscan.io/tx/3R1nSWayY37tX5LepW7c1r4PgsB9nKGGS6xEEUZ1jLrkuLJiD5YLCvxEF7fXp9rDrprNDuyL74KEHxVxuWWoyvt2) | Sora /videos — no response from rendering pipeline |
| 2026-05-30 | video-pixverse | $0.116000 | [`VV4bFMTAA7zbR4po...`](https://solscan.io/tx/VV4bFMTAA7zbR4poAGz6mYpX3H7zbPhFkST8raebRpxEFDVXeLuu1ck984iTbCTEezeCEkE9XwsBKGYmhL22xYi) | Pixverse with model=v3.5 — 500 'api unexpected error' |
| 2026-06-01 | video-seedance | $0.104736 | [`ogTTeNpn5mTikPVm...`](https://solscan.io/tx/ogTTeNpn5mTikPVmmdCCPiLdj4XxXn1ki3zaEgmZvZ3Z3VSrDaGVNYSAoAi62FAHaUx64xz2LJpYsxQp3pWS1No) | Seedance pre-submit probe — proved video stage settles on x402 |

### Debug-era smoke tests — May 26-27, 2026

| Date | Stage | USDC | Signature | Note |
|---|---|---:|---|---|
| 2026-05-26 | chat | $0.095000 | [`51gF7vSMfNdxxxYA...`](https://solscan.io/tx/51gF7vSMfNdxxxYAEzyb1cbj8f2Ay1uhiGxVZefwS1B7M2b37wAgK6PZWSXUL2DgywRgtSTkhuaDsN2mWqyPNqKJ) | early smoke test |
| 2026-05-26 | chat | $0.095000 | [`5fA6WrzDZibMtQr2...`](https://solscan.io/tx/5fA6WrzDZibMtQr2NDbH4AKsdbQJNd7Gp5QxkU6q53n7h7bGhgqM1bmF3Jz7JsMrqr18oPkgU66euMcf57Gb6TGv) | early smoke test |
| 2026-05-27 | chat | $0.095000 | [`5Kc1CapWEgFkB5WV...`](https://solscan.io/tx/5Kc1CapWEgFkB5WVww1Dhn25v46aaSoyj4F1SfTquLg3CQv5pWTnxa5s3xRUxCvTJBizeDmjRuvzXp6ysPPnwLDj) | early smoke test |
| 2026-05-27 | chat | $0.095000 | [`4CrCjmbdHu6Zh5tE...`](https://solscan.io/tx/4CrCjmbdHu6Zh5tEThe1nv29prDsPu9zZWJG8Cd9VqSjYETwyNLcM3eufxfeTJnjmRADAuG8UUPzJPiQfc1dnntU) | early smoke test |
| 2026-05-27 | chat | $0.095000 | [`jhWKFRP2HfpkgbYx...`](https://solscan.io/tx/jhWKFRP2HfpkgbYxthxgfRrYRymri5TrBfJRth59M9QZgYmHxhqKKJNQ3zgknqVHPFd2cDJHgP8sZLWRHXSFy8L) | early smoke test |

---

## Canonical envelope investigation (NOT settled — open question with team)

Tested separately against Ace Data's reference [X402Client repo](https://github.com/AceDataCloud/X402Client)
canonical envelope (facilitator-as-feePayer, partial-sign only, X-Payment
carries `serializedTransaction`). Three video providers returned successful
video URLs, but no facilitator-submitted on-chain settlement was observed
for any of the five attempts within 12+ hours of `getSignaturesForAddress`
RPC tracing.

Reported to the Ace Data team in the OOBE troubleshoot channel. Not
included in the settlement count above because these did not result in
verifiable on-chain transfers.

| Provider | Quoted | Video URL | Note |
|---|---:|---|---|
| Veo (run 1) | $0.727442 | [veo/a5b1073b...mp4](https://platform.cdn.acedata.cloud/veo/a5b1073b-76ed-4f36-84bf-7038cdf30336.mp4) | state=succeeded |
| Veo (run 2) | $0.727442 | [veo/d996b2e5...mp4](https://platform.cdn.acedata.cloud/veo/d996b2e5-5106-416f-bcc6-195df4d4b404.mp4) | state=succeeded |
| Veo (run 3) | $0.727442 | [veo/07bbdfbf...mp4](https://platform.cdn.acedata.cloud/veo/07bbdfbf-7a1d-446d-9c24-8873e260b0d2.mp4) | state=succeeded |
| Kling | $1.333009 | [kling/629394ee...mp4](https://platform.cdn.acedata.cloud/kling/629394ee-c1ff-4e52-9eec-4b0638033e19.mp4) | state=succeed |
| Seedance | $0.104736 | [seedance/b303bcbd...mp4](https://platform.cdn.acedata.cloud/seedance/b303bcbd-b853-48ff-861b-7936897e6552.mp4) | 1080p / 16:9 / 5s / 24fps |

