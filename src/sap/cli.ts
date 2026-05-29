import { config } from '../config.js';
import { log } from '../util/log.js';
import { loadSapKeypair } from './sdk.js';
import { registerWhaleWatchAgent } from './register.js';

/**
 * One-off SAP registration command.
 *   npm run register:dry  -> builds the instruction, prints every account, sends nothing
 *   npm run register      -> registers on mainnet (costs ~0.13 SOL)
 *
 * Run the dry-run first and eyeball the account list before the live send.
 */
async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  log.info(`SAP registration — ${dryRun ? 'DRY RUN (nothing will be sent)' : 'LIVE on mainnet'}.`);

  const keypair = loadSapKeypair(config.agentKeypairPath);
  log.info(`Agent wallet: ${keypair.publicKey.toBase58()}`);

  const result = await registerWhaleWatchAgent({
    keypair,
    rpcUrl: config.solanaRpcUrl,
    dryRun,
    x402Endpoint: config.agentX402Endpoint || null,
    metadataUri: config.agentMetadataUri || null,
  });

  log.info(`Agent PDA:        ${result.agentPda}`);
  log.info(`Agent stats PDA:  ${result.agentStatsPda}`);
  log.info(`Global registry:  ${result.globalRegistryPda}`);

  if (result.alreadyRegistered) {
    log.info('This agent is ALREADY registered on SAP. Nothing to do, no SOL spent.');
    return;
  }

  log.info(`Registration instruction accounts (${result.accounts.length}):`);
  for (const a of result.accounts) {
    log.info(
      `  [${a.index}] ${a.pubkey}  ${a.isSigner ? 'signer ' : '       '}` +
        `${a.isWritable ? 'writable' : 'readonly'}`,
    );
  }

  if (dryRun) {
    log.info('DRY RUN complete — instruction built, nothing sent. Review the accounts above.');
    log.info('When ready, register for real with: npm run register');
    return;
  }

  if (!result.signature) {
    throw new Error('Live registration returned no signature.');
  }
  log.info(`REGISTERED. Transaction: ${result.signature}`);
  log.info(`Explorer: https://explorer.solana.com/tx/${result.signature}?cluster=mainnet-beta`);
  log.info('Verify the agent at https://explorer.oobeprotocol.ai');
}

main().catch((err) => {
  log.error('Registration failed.', err);
  process.exit(1);
});
