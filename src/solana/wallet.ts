import { readFileSync } from 'node:fs';
import { Keypair, Connection, Transaction } from '@solana/web3.js';
import type { SolanaWalletAdapter } from '@acedatacloud/x402-client';

export interface LoadedWallet {
  address: string;
  connection: Connection;
  adapter: SolanaWalletAdapter;
}

/**
 * Load a Solana keypair from a solana-keygen JSON file (a 64-byte secret-key
 * array). Shared by the x402 wallet adapter and SAP registration.
 */
export function loadKeypair(keypairPath: string): Keypair {
  let secret: number[];
  try {
    secret = JSON.parse(readFileSync(keypairPath, 'utf8')) as number[];
  } catch (err) {
    throw new Error(
      `Could not read Solana keypair at ${keypairPath}. ` +
        `Generate one with 'solana-keygen new -o ${keypairPath}'. (${String(err)})`,
    );
  }
  if (!Array.isArray(secret) || secret.length !== 64) {
    throw new Error(`Keypair file ${keypairPath} is not a 64-byte secret key array.`);
  }
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

/**
 * Load the agent's Solana keypair from a solana-keygen JSON file and build the
 * SolanaWalletAdapter that @acedatacloud/x402-client expects. Only called in
 * live mode — dry-run never needs a wallet.
 */
export function loadWallet(keypairPath: string, rpcUrl: string): LoadedWallet {
  const keypair = loadKeypair(keypairPath);
  const connection = new Connection(rpcUrl, 'confirmed');

  const adapter: SolanaWalletAdapter = {
    publicKey: {
      toBase58: () => keypair.publicKey.toBase58(),
      toString: () => keypair.publicKey.toBase58(),
    },
    // signSolanaPayment builds the tx (feePayer + recentBlockhash already set);
    // we sign with the keypair and broadcast through the Synapse RPC connection.
    async signAndSendTransaction(tx: unknown): Promise<{ signature: string }> {
      const transaction = tx as Transaction;
      transaction.sign(keypair);
      const signature = await connection.sendRawTransaction(transaction.serialize());
      await connection.confirmTransaction(signature, 'confirmed');
      return { signature };
    },
  };

  return { address: keypair.publicKey.toBase58(), connection, adapter };
}
