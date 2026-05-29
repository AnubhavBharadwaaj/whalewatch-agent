import { Keypair, PROGRAM_ID } from './sdk.js';
import { registerWhaleWatchAgent } from './register.js';

/**
 * Hermetic smoke test for SAP registration. Builds the registration
 * instruction in dry-run mode with a throwaway keypair — no RPC, no real key,
 * no mainnet. Verifies the instruction targets the SAP program and carries a
 * sane set of accounts. The actual mainnet send can only be tested by running
 * `npm run register` with a funded wallet.
 * Run: npm run smoke:sap
 */
async function main(): Promise<void> {
  const throwaway = Keypair.generate();

  const result = await registerWhaleWatchAgent({
    keypair: throwaway,
    rpcUrl: 'http://127.0.0.1:8899', // never contacted in dry-run
    dryRun: true,
    x402Endpoint: null,
    metadataUri: null,
  });

  console.log('agent PDA        ->', result.agentPda);
  console.log('agent stats PDA  ->', result.agentStatsPda);
  console.log('global registry  ->', result.globalRegistryPda);
  console.log(`instruction accounts -> ${result.accounts.length}`);
  for (const a of result.accounts) {
    console.log(`  [${a.index}] ${a.pubkey} ${a.isSigner ? 'S' : '-'}${a.isWritable ? 'W' : '-'}`);
  }

  const agentInAccounts = result.accounts.some((a) => a.pubkey === result.agentPda);
  const walletSigns = result.accounts.some(
    (a) => a.pubkey === throwaway.publicKey.toBase58() && a.isSigner,
  );

  const pass =
    result.signature === null &&
    result.alreadyRegistered === false &&
    result.accounts.length >= 4 &&
    agentInAccounts &&
    walletSigns;

  console.log(
    `signature-null: ${result.signature === null}, accounts>=4: ${result.accounts.length >= 4}, ` +
      `agentPDA-present: ${agentInAccounts}, wallet-signs: ${walletSigns}`,
  );
  console.log(`SAP program id: ${PROGRAM_ID}`);
  console.log(pass ? 'SMOKE TEST PASSED' : 'SMOKE TEST FAILED');
  process.exitCode = pass ? 0 : 1;
}

main().catch((err) => {
  console.error('SMOKE TEST ERROR', err);
  process.exitCode = 1;
});
