import {
  Wallet,
  Connection,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  ComputeBudgetProgram,
  createSapClient,
  Pdas,
  PROGRAM_ID,
  type SapKeypair,
} from './sdk.js';

/**
 * SAP agent registration (architecture §8).
 *
 * Registers WhaleWatch on the Synapse Agent Protocol on Solana mainnet via
 * synapse-sap-sdk v0.18.0. registerAgent costs a 0.1 SOL protocol fee plus
 * account rent — budget ~0.13 SOL for this one-time call.
 *
 * NOTE on the v0.17 IDL drift: two competitors reported v0.17.0's IDL not
 * matching the deployed program (agentStats vs systemProgram account order).
 * v0.18.0 is the newer published version and should resolve it, but it cannot
 * be verified without a mainnet send. Hence the dry-run mode below — it builds
 * the instruction and prints every account so you can inspect before sending.
 */

const NAME = 'WhaleWatch';
const DESCRIPTION =
  'Autonomous whale-movement analysis agent: $10M+ on-chain transfers turned into ' +
  'LLM analysis, an infographic, and a market-mood video, each Ace Data Cloud call ' +
  'settled via x402 on Solana.';

const PROTOCOLS = ['x402'];

export interface RegisterOptions {
  keypair: SapKeypair;
  rpcUrl: string;
  dryRun: boolean;
  /** Optional sell-side x402 endpoint to advertise. null = none. */
  x402Endpoint: string | null;
  /** Optional metadata URI to advertise. null = none. */
  metadataUri: string | null;
}

export interface RegisterResult {
  agentPda: string;
  agentStatsPda: string;
  globalRegistryPda: string;
  alreadyRegistered: boolean;
  /** Settlement signature. null in dry-run, or if the agent was already registered. */
  signature: string | null;
  /** Every account in the registration instruction — inspect before a live send. */
  accounts: { index: number; pubkey: string; isSigner: boolean; isWritable: boolean }[];
}

export async function registerWhaleWatchAgent(opts: RegisterOptions): Promise<RegisterResult> {
  const wallet = new Wallet(opts.keypair);
  const client = createSapClient(opts.rpcUrl, wallet);

  const [agentPda] = Pdas.getAgentPDA(opts.keypair.publicKey);
  // SDK bug: Pdas.getAgentStatsPDA derives ["sap_stats", wallet], but the
  // deployed program expects ["sap_stats", agentPda] — passing the SDK's value
  // fails with a ConstraintSeeds violation (Anchor error 2006). Verified by
  // brute-forcing against the PDA the program reported as expected.
  const [agentStatsPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('sap_stats'), agentPda.toBuffer()],
    new PublicKey(PROGRAM_ID),
  );
  const [globalRegistryPda] = Pdas.getGlobalPDA();

  const base = {
    agentPda: agentPda.toBase58(),
    agentStatsPda: agentStatsPda.toBase58(),
    globalRegistryPda: globalRegistryPda.toBase58(),
  };

  const connection = new Connection(opts.rpcUrl, 'confirmed');

  // Already-registered guard. Registration costs 0.1 SOL — never pay twice.
  // A raw getAccountInfo check is IDL-name-independent and robust.
  if (!opts.dryRun) {
    const existing = await connection.getAccountInfo(agentPda);
    if (existing) {
      return { ...base, alreadyRegistered: true, signature: null, accounts: [] };
    }
  }

  const ix = await client.agent.registerAgent({
    signer: opts.keypair,
    wallet: opts.keypair.publicKey,
    agent: agentPda,
    agentStats: agentStatsPda,
    globalRegistry: globalRegistryPda,
    name: NAME,
    description: DESCRIPTION,
    // SDK bug: synapse-sap-sdk v0.18.0's borsh coder throws "indeterminate
    // span" when encoding a non-empty Vec<Capability> — the Option<string>
    // fields in the Capability struct. Isolated by probing; an empty array
    // encodes cleanly. The agent still registers with name, description,
    // protocols and agentId. Per-capability indexing is added once the SDK
    // ships a fix, via updateAgent.
    capabilities: [],
    // Sell-side pricing added later via updateAgent (needs the TokenType
    // enum verified against the program). Buyer-surface registration is
    // valid with no pricing tiers — architecture §8.
    pricing: [],
    protocols: PROTOCOLS,
    agentId: 'whalewatch',
    agentUri: opts.metadataUri,
    x402Endpoint: opts.x402Endpoint,
  });

  const accounts = ix.keys.map((k, index) => ({
    index,
    pubkey: k.pubkey.toBase58(),
    isSigner: k.isSigner,
    isWritable: k.isWritable,
  }));

  if (ix.programId.toBase58() !== PROGRAM_ID) {
    throw new Error(
      `Registration instruction targets ${ix.programId.toBase58()}, expected SAP ${PROGRAM_ID}.`,
    );
  }

  if (opts.dryRun) {
    return { ...base, alreadyRegistered: false, signature: null, accounts };
  }

  // The SDK's buildTransaction returns a VersionedTransaction, but its
  // sendTransaction forwards a signers array to web3.js's
  // Connection.sendTransaction — which rejects (signers array + versioned tx
  // = "Invalid arguments"). So we bypass the SDK's send path: build a legacy
  // Transaction from the instruction and broadcast it with web3.js directly.
  // A generous compute-unit limit avoids a "budget exceeded" failure on the
  // account-creating registration instruction.
  const tx = new Transaction()
    .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }))
    .add(ix);
  tx.feePayer = opts.keypair.publicKey;
  const signature = await sendAndConfirmTransaction(connection, tx, [opts.keypair]);
  return { ...base, alreadyRegistered: false, signature, accounts };
}
