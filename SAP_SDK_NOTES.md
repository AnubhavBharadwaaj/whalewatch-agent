# Notes on `@oobe-protocol-labs/synapse-sap-sdk@0.18.0`

While registering WhaleWatch on Solana mainnet I worked around four issues in the v0.18.0 SDK. Writing them up so other agent builders can short-circuit the same debugging, and so this can serve as a draft of what I'd file against the SDK repo as a set of issues / PRs.

The registration eventually went through with these workarounds:

- **Agent name:** `WhaleWatch`
- **Agent PDA:** `9SdK2ihjbbjEKaEEBuiDoyWUhCX6e3n5aKePAZCxH1JJ` ([Solscan](https://solscan.io/account/9SdK2ihjbbjEKaEEBuiDoyWUhCX6e3n5aKePAZCxH1JJ))
- **Registration tx:** `3Ai6KxrkxZhiyrDZE9PVRMEddsHoSHdHcmaZi6noReoytaREvLWvzA6aJpJ6nGY4VMz5g5eT92AfFASEmskCUnBg` ([Solscan](https://solscan.io/tx/3Ai6KxrkxZhiyrDZE9PVRMEddsHoSHdHcmaZi6noReoytaREvLWvzA6aJpJ6nGY4VMz5g5eT92AfFASEmskCUnBg))
- **Deployed program:** `SAPpUhsWLJG1FfkGRcXagEDMrMsWGjbky7AyhGpFETZ`

Independent corroboration that this isn't local noise: two other Category 2 submitters report the same family of issues. `tolga-tom-nook` describes "account-order drift" during registration; `cutlerjay109` was more specific — the SDK passes `agentStats` at account position 3 where the deployed program expects `systemProgram`, breaking `createEscrowV2`, `updateAgent`, `closeAgent`. The four items below are what I hit on the `register_agent` path and how I got past each one.

---

## 1. Published ESM build is unloadable; must route through CJS

**Symptom.** Direct ESM `import` from `@oobe-protocol-labs/synapse-sap-sdk` fails at module-resolution. The SDK's compiled `index.js` uses extensionless directory imports of the form `export … from './constants'`, which Node ESM rejects with `ERR_UNSUPPORTED_DIR_IMPORT`. The CJS build loads fine.

**Workaround.** A `createRequire`-based shim that loads the SDK along with `@solana/web3.js` and `@coral-xyz/anchor` through one CJS module instance, so every object the SDK touches comes from a consistent source (no dual-package hazard). Every other file in the agent imports from the shim, never from the package directly. Type definitions still resolve from each package's `.d.ts`.

**Location:** `src/sap/sdk.ts`

**Suggested fix.** Add explicit `.js` extensions to internal directory imports in the ESM build, or ship a dual `exports` map in `package.json` with the ESM entry actually loadable.

---

## 2. `Pdas.getAgentStatsPDA` derives the wrong seeds

**Symptom.** The SDK helper `Pdas.getAgentStatsPDA(wallet)` derives the seeds `["sap_stats", wallet]`, but the deployed program expects `["sap_stats", agentPda]`. Passing the SDK's value into `registerAgent` fails with a `ConstraintSeeds` violation (Anchor error code 2006). Verified by brute-forcing against the PDA the program reported as expected.

**Workaround.** Derive the stats PDA manually against the correct seeds:

```ts
const [agentStatsPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('sap_stats'), agentPda.toBuffer()],
  new PublicKey(PROGRAM_ID),
);
```

**Location:** `src/sap/register.ts`

**Suggested fix.** Change the second seed in `Pdas.getAgentStatsPDA` from `wallet` to `agentPda`.

---

## 3. Borsh "indeterminate span" when encoding `Vec<Capability>`

**Symptom.** Calling `registerAgent` with a non-empty `capabilities: Capability[]` throws "indeterminate span" out of the SDK's borsh coder. The failure isolates to the `Option<string>` fields inside the `Capability` struct — the coder can't determine the size of an Option-of-string ahead of time. An empty array encodes cleanly.

**Workaround.** Register with `capabilities: []` and add per-capability metadata later via `updateAgent` once the SDK ships a fix. Name, description, `protocols`, `agentId`, `agentUri`, and `x402Endpoint` all encode fine — the agent registers as a buyer-side surface, which is what the Category 2 buyer flow needs anyway.

**Location:** `src/sap/register.ts`

**Suggested fix.** Either bound each `Option<string>` to a fixed maximum length in the IDL, or swap the affected borsh-coder calls for an explicit serializer that handles variable-length Option fields.

---

## 4. SDK's `sendTransaction` rejects its own `buildTransaction` output

**Symptom.** The SDK's `buildTransaction` produces a `VersionedTransaction`, but its `sendTransaction` forwards a signers array into `Connection.sendTransaction`, which rejects with "Invalid arguments" when given (versioned transaction + signers array). The two helpers don't compose.

**Workaround.** Bypass the SDK's send path entirely. Build a legacy `Transaction` from the `registerAgent` instruction, attach a generous compute-unit limit (account-creating instructions otherwise exceed the default budget), set `feePayer`, and broadcast through `web3.js`'s `sendAndConfirmTransaction` directly:

```ts
const tx = new Transaction()
  .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }))
  .add(ix);
tx.feePayer = opts.keypair.publicKey;
const signature = await sendAndConfirmTransaction(connection, tx, [opts.keypair]);
```

**Location:** `src/sap/register.ts`

**Suggested fix.** Either have `sendTransaction` drop the signers array for already-signed versioned transactions, or have `buildTransaction` return a legacy `Transaction` consistently with what `sendTransaction` expects.

---

## What's not affected

`register_agent` itself isn't in the IDL-drift breakage list `cutlerjay109` reported (`createEscrowV2`, `updateAgent`, `closeAgent` are). It's reachable with the four workarounds above, which is how WhaleWatch is registered on mainnet today.

For a buyer-side agent that settles per service call through Ace Data's facilitator ([X402Client](https://github.com/AceDataCloud/X402Client) talking to [FacilitatorX402](https://github.com/AceDataCloud/FacilitatorX402)) rather than the SAP program's on-chain escrow, `createEscrowV2` — the most broken instruction in the drift — isn't on the critical path. So the SDK's escrow being unusable today doesn't block agents that pay per call through the facilitator.

## If anyone from OOBE Protocol Labs reads this

Happy to turn these four sections into individual GitHub issues against the [synapse-sap-sdk repo](https://github.com/OOBE-PROTOCOL/synapse-sap-sdk), each with a minimal repro. Three of the four — (2), (3), and (4) — look like one root cause: SDK bindings drifted from the deployed program. (1) is independent and probably the quickest to fix.
