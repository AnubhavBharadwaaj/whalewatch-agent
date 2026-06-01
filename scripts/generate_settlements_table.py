#!/usr/bin/env python3
"""
Generates x402_settlements.md from the load test receipts JSONL plus
the inline-catalogued prior probe settlements.

Usage:
    python3 scripts/generate_settlements_table.py > x402_settlements.md

Or pipe to stdout to preview:
    python3 scripts/generate_settlements_table.py | head -50
"""

import json
import sys
from collections import defaultdict
from pathlib import Path

RECEIPTS_PATH = Path("data/x402-load-test-receipts.jsonl")
WALLET = "FBykJfwmAyFK8mrqh1dgPAARFFCv1agUTGNfex6SDebj"
SOLSCAN_TX = "https://solscan.io/tx/"
SOLSCAN_ACC = "https://solscan.io/account/"

# ----------------------------------------------------------------------
# Prior settlements catalogued from probe work May 26–30, 2026.
# Each entry: (date_iso, category, stage, signature, usdc_amount, note)
# ----------------------------------------------------------------------
PRIOR_SETTLEMENTS = [
    # ---- May 26-27: debug-era smoke tests ----
    ("2026-05-26", "debug-era", "chat",  "51gF7vSMfNdxxxYAEzyb1cbj8f2Ay1uhiGxVZefwS1B7M2b37wAgK6PZWSXUL2DgywRgtSTkhuaDsN2mWqyPNqKJ", 0.095, "early smoke test"),
    ("2026-05-26", "debug-era", "chat",  "5fA6WrzDZibMtQr2NDbH4AKsdbQJNd7Gp5QxkU6q53n7h7bGhgqM1bmF3Jz7JsMrqr18oPkgU66euMcf57Gb6TGv", 0.095, "early smoke test"),
    ("2026-05-27", "debug-era", "chat",  "5Kc1CapWEgFkB5WVww1Dhn25v46aaSoyj4F1SfTquLg3CQv5pWTnxa5s3xRUxCvTJBizeDmjRuvzXp6ysPPnwLDj", 0.095, "early smoke test"),
    ("2026-05-27", "debug-era", "chat",  "4CrCjmbdHu6Zh5tEThe1nv29prDsPu9zZWJG8Cd9VqSjYETwyNLcM3eufxfeTJnjmRADAuG8UUPzJPiQfc1dnntU", 0.095, "early smoke test"),
    ("2026-05-27", "debug-era", "chat",  "jhWKFRP2HfpkgbYxthxgfRrYRymri5TrBfJRth59M9QZgYmHxhqKKJNQ3zgknqVHPFd2cDJHgP8sZLWRHXSFy8L",  0.095, "early smoke test"),

    # ---- May 28: live cycle ----
    ("2026-05-28", "live-cycle", "memo", "4NaV1GXgy96XMgKbp6gnrEeNzyQ6aYeYDWsjJg7t1Uz63dQr45EpHLJZTPpnDAWGxL3s6rDFeTeYvz77KnDdGBda", 0.0, "agent receipt memo for $9.9M USDC whale cycle"),

    # ---- May 29-30: pre-submit probes (chat + image + various video providers) ----
    ("2026-05-29", "probe", "chat",        "4e37dfQFVsfwAHUx88BZaES6d4LMZbpLeRedq6DQp2UbmLu4b9T49KxvDczpKqbDDWkfeaBauFm189VzYTx6aMc", 0.095, "gpt-4o-mini chat probe — proved chat stage on x402"),
    ("2026-05-29", "probe", "image",       "4GRJdreKw1GZDqtKAeVjPxCg1JqNMW86xPVBi63X1oKxurXhRUaJYsvVzeE5C52icps32LrUYG4TMoW7dK9gHRAi", 0.019, "DALL-E image probe — proved image stage on x402"),
    ("2026-05-30", "probe", "video-luma",  "5R1bksiaMnuPqJsWHmEtuav71MKCCX3cxVJNnj6oAKudw53XHtAMKZVLgNQcDf4eahxkABt7ThaT7K6qsPJTAhdK", 0.113, "Luma — 500 (Doms confirmed Luma is known unstable on x402)"),
    ("2026-05-30", "probe", "video-luma",  "5yj1XpdiZqMJVtw312MdLwCeMfLGZZoU4pJ1xF1173ospvhRthhKFksy8TX8rSqqqoKDfZYk7iWjN7qVP6nVYAya", 0.113, "Luma retry — same outcome"),
    ("2026-05-30", "probe", "video-hailuo","4EcX3XNoMGBq1EUCy9rM5GS5v9NoFtkr7ZWAp31vXqfW5pgjhpP3JYZTFne6tEFJg6V41mJuSUF3wPiTiCo3odxq", 0.164, "Hailuo — 500 'no channel for default group'"),
    ("2026-05-30", "probe", "video-kling", "3ow9FGRcFJ1RzjuBzoB8jnMk252S3pnCb1p6HXpm3rdB5Nc6VQpiBRFjEirfWWwjLY4E9Y8GCoefhAhd72PBiFqZ", 0.095, "Kling pre-submit — no response from rendering pipeline"),
    ("2026-05-30", "probe", "video-sora",  "47hz5V4DcqfBDb7BmoigCJkHC9xeJpXcEbYwvpT7kRHLtpa9p7WtQDt9m4zVSkqX7yV8SHywzKNZ4wSWG1kex1D2", 0.095, "Sora /tasks — 200 but empty body"),
    ("2026-05-30", "probe", "video-pixverse","SDsREsiJtdnzVDgnULjMLBC54tN4StD4xET9ge1yg1aVyw9tJjxy8GufJQRzVD2CpZQbLeZF78nFrpsQhZSRjUs", 0.116, "Pixverse — 400 'model required'"),
    ("2026-05-30", "probe", "video-wan",   "36zLXD69LwzhsmZv2teCfkbSxasH83GaFcrtj5iwQPPYUXguFUt4b14Nv4pVkZvHvqhZXwwrZJzcY9XXnmjNDUB2", 1.671, "Wan — 400 'model required'"),
    ("2026-05-30", "probe", "video-kling", "2mTLS51UgoCaLnkbdhgCbE5vSryg8f8NT1b9DjGg9Ajyg2zLaYXEZtkQ2o2d4zaSYCpLmUcPzAvjv7ymnJYUkewF", 0.095, "Kling retry with long undici timeout — still no response"),
    ("2026-05-30", "probe", "video-sora",  "3R1nSWayY37tX5LepW7c1r4PgsB9nKGGS6xEEUZ1jLrkuLJiD5YLCvxEF7fXp9rDrprNDuyL74KEHxVxuWWoyvt2", 0.053, "Sora /videos — no response from rendering pipeline"),
    ("2026-05-30", "probe", "video-pixverse","VV4bFMTAA7zbR4poAGz6mYpX3H7zbPhFkST8raebRpxEFDVXeLuu1ck984iTbCTEezeCEkE9XwsBKGYmhL22xYi", 0.116, "Pixverse with model=v3.5 — 500 'api unexpected error'"),

    # ---- May 31: verification ----
    # NOTE: the 1-cycle smoke test sigs (3zUYtuoK... and 588Z1x9Y...) are already
    # in the JSONL file (same output file as the 50-cycle run), so they're NOT
    # repeated here to avoid double-counting.
    ("2026-05-31", "verify", "image-flux", "GcYZog7kdsbWcrEndhGfBLtBkEAXJRjQWAf9WhTTFxFcmX8JgzgafF4TK6Crah8jmCSziAEPKTEv5WC5JRKFxb1", 0.022851, "verify:x402 paid live verification — flux-dev image"),

    # ---- June 1: Seedance pre-submit probe ----
    ("2026-06-01", "probe", "video-seedance", "ogTTeNpn5mTikPVmmdCCPiLdj4XxXn1ki3zaEgmZvZ3Z3VSrDaGVNYSAoAi62FAHaUx64xz2LJpYsxQp3pWS1No", 0.104736, "Seedance pre-submit probe — proved video stage settles on x402"),
]


def parse_receipts():
    """Read receipts JSONL, return list of settled entries."""
    if not RECEIPTS_PATH.exists():
        return []
    settled = []
    with open(RECEIPTS_PATH) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            entry = json.loads(line)
            if entry.get("status") == "settled":
                settled.append(entry)
    return settled


def short_sig(sig: str, n: int = 16) -> str:
    return f"{sig[:n]}..."


def link(sig: str) -> str:
    return f"[`{short_sig(sig)}`]({SOLSCAN_TX}{sig})"


def write_header():
    print("# x402 Settlements on Solana Mainnet")
    print()
    print(f"All payments below are real on-chain USDC transfers from the agent wallet on Solana mainnet, settled via the x402 protocol against Ace Data Cloud endpoints.")
    print()
    print(f"**Wallet:** [`{WALLET}`]({SOLSCAN_ACC}{WALLET})  ")
    print(f"**Asset:** USDC (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`)  ")
    print(f"**Counterparty (Ace Data):** [`5iVXFrYaYWX2GUTbkQj8mDBoBhAX8bneYigS2LJTia43`]({SOLSCAN_ACC}5iVXFrYaYWX2GUTbkQj8mDBoBhAX8bneYigS2LJTia43)  ")
    print()


def write_summary(load_test_entries):
    n_load = len(load_test_entries)
    n_prior = len(PRIOR_SETTLEMENTS)
    total_load = sum(int(e["amountAtomic"]) for e in load_test_entries) / 1e6
    total_prior = sum(amt for (_d, _c, _s, _sig, amt, _n) in PRIOR_SETTLEMENTS)
    print("## Summary")
    print()
    print("| Source | Settlements | USDC settled |")
    print("|---|---:|---:|")
    print(f"| Load test | {n_load} | ${total_load:.6f} |")
    print(f"| Prior probes + verify + smoke | {n_prior} | ${total_prior:.6f} |")
    print(f"| **Total verifiable on-chain** | **{n_load + n_prior}** | **${total_load + total_prior:.6f}** |")
    print()
    print("---")
    print()


def write_load_test_section(entries):
    n = len(entries)
    print(f"## Load test — production cycles (May 31 – Jun 1, 2026)")
    print()
    print(f"Drove the production `analyzeWhaleEvent`, `generateImage`, and Seedance video")
    print(f"stage functions through synthetic whale events to validate that the live")
    print(f"x402 path scales. Per-stage error isolation kept settled stages durable")
    print(f"through Ace Data's intermittent auth-service 500s.")
    print()
    print(f"- Settlements landed: **{n}**")
    print(f"- Total spent: ~${sum(int(e['amountAtomic']) for e in entries) / 1e6:.6f} USDC")
    print(f"- Receipts: `data/x402-load-test-receipts.jsonl`")
    print()

    by_stage = defaultdict(int)
    by_stage_amount = defaultdict(int)
    for e in entries:
        by_stage[e["stage"]] += 1
        by_stage_amount[e["stage"]] += int(e["amountAtomic"])
    print("**Breakdown by stage:**")
    print()
    print("| Stage | Settled | USDC |")
    print("|---|---:|---:|")
    for stage in sorted(by_stage):
        usd = by_stage_amount[stage] / 1e6
        print(f"| {stage} | {by_stage[stage]} | ${usd:.6f} |")
    print()

    print("**All settlement signatures:**")
    print()
    print("| Cycle | Stage | USDC | Signature |")
    print("|---:|---|---:|---|")
    for e in sorted(entries, key=lambda x: (x["cycleNum"], x["stage"])):
        usd = int(e["amountAtomic"]) / 1e6
        print(f"| {e['cycleNum']} | {e['stage']} | ${usd:.6f} | {link(e['signature'])} |")
    print()
    print("---")
    print()


def write_prior_settlements():
    print("## Prior settlements (May 26-31, 2026)")
    print()
    print("Earlier x402 work — probe scripts, the May 28 live cycle, and the")
    print("May 31 paid verification + smoke test cycle. Every signature below is")
    print("a real on-chain USDC transfer (the Luma/Hailuo/Pixverse/etc. entries")
    print("settled even when the service failed afterward — that's how pre-submit")
    print("x402 works: payment first, fulfillment second).")
    print()

    # Group by category
    by_cat = defaultdict(list)
    for entry in PRIOR_SETTLEMENTS:
        by_cat[entry[1]].append(entry)

    cat_titles = {
        "live-cycle":  "### Live cycle — May 28, 2026",
        "verify":      "### Live x402 verification — May 31, 2026",
        "smoke":       "### 1-cycle smoke test — May 31, 2026",
        "probe":       "### Pre-submit probes — May 29-30, 2026",
        "debug-era":   "### Debug-era smoke tests — May 26-27, 2026",
    }
    cat_order = ["verify", "smoke", "live-cycle", "probe", "debug-era"]

    for cat in cat_order:
        if cat not in by_cat:
            continue
        print(cat_titles[cat])
        print()
        print("| Date | Stage | USDC | Signature | Note |")
        print("|---|---|---:|---|---|")
        for date, _c, stage, sig, amt, note in by_cat[cat]:
            print(f"| {date} | {stage} | ${amt:.6f} | {link(sig)} | {note} |")
        print()


def write_canonical_section():
    print("---")
    print()
    print("## Canonical envelope investigation (NOT settled — open question with team)")
    print()
    print("Tested separately against Ace Data's reference [X402Client repo](https://github.com/AceDataCloud/X402Client)")
    print("canonical envelope (facilitator-as-feePayer, partial-sign only, X-Payment")
    print("carries `serializedTransaction`). Three video providers returned successful")
    print("video URLs, but no facilitator-submitted on-chain settlement was observed")
    print("for any of the five attempts within 12+ hours of `getSignaturesForAddress`")
    print("RPC tracing.")
    print()
    print("Reported to the Ace Data team in the OOBE troubleshoot channel. Not")
    print("included in the settlement count above because these did not result in")
    print("verifiable on-chain transfers.")
    print()
    print("| Provider | Quoted | Video URL | Note |")
    print("|---|---:|---|---|")
    print("| Veo (run 1) | $0.727442 | [veo/a5b1073b...mp4](https://platform.cdn.acedata.cloud/veo/a5b1073b-76ed-4f36-84bf-7038cdf30336.mp4) | state=succeeded |")
    print("| Veo (run 2) | $0.727442 | [veo/d996b2e5...mp4](https://platform.cdn.acedata.cloud/veo/d996b2e5-5106-416f-bcc6-195df4d4b404.mp4) | state=succeeded |")
    print("| Veo (run 3) | $0.727442 | [veo/07bbdfbf...mp4](https://platform.cdn.acedata.cloud/veo/07bbdfbf-7a1d-446d-9c24-8873e260b0d2.mp4) | state=succeeded |")
    print("| Kling | $1.333009 | [kling/629394ee...mp4](https://platform.cdn.acedata.cloud/kling/629394ee-c1ff-4e52-9eec-4b0638033e19.mp4) | state=succeed |")
    print("| Seedance | $0.104736 | [seedance/b303bcbd...mp4](https://platform.cdn.acedata.cloud/seedance/b303bcbd-b853-48ff-861b-7936897e6552.mp4) | 1080p / 16:9 / 5s / 24fps |")
    print()


def main():
    settlements = parse_receipts()
    write_header()
    write_summary(settlements)
    write_load_test_section(settlements)
    write_prior_settlements()
    write_canonical_section()


if __name__ == "__main__":
    main()
