import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

/**
 * CJS interop shim for synapse-sap-sdk.
 *
 * The SDK's published ESM build is broken: its compiled index.js uses
 * extensionless directory imports (`export ... from './constants'`), which Node
 * ESM rejects with ERR_UNSUPPORTED_DIR_IMPORT. The CJS build works. So this
 * shim loads the SDK — plus web3.js and anchor — through createRequire, so
 * every object handed to the SDK comes from a single consistent module
 * instance (no dual-package hazard). Types still resolve from each package's
 * .d.ts. Everything SAP-related imports from this file, nowhere else.
 */
const require = createRequire(import.meta.url);

const web3 = require('@solana/web3.js') as typeof import('@solana/web3.js');
const anchor = require('@coral-xyz/anchor') as typeof import('@coral-xyz/anchor');
const sdk = require('@oobe-protocol-labs/synapse-sap-sdk') as typeof import('@oobe-protocol-labs/synapse-sap-sdk');

export const Keypair = web3.Keypair;
export const PublicKey = web3.PublicKey;
export const Connection = web3.Connection;
export const Transaction = web3.Transaction;
export const sendAndConfirmTransaction = web3.sendAndConfirmTransaction;
export const ComputeBudgetProgram = web3.ComputeBudgetProgram;
export const Wallet = anchor.Wallet;

export const createSapClient = sdk.createSapClient;
export const Pdas = sdk.Pdas;
export const PROGRAM_ID = sdk.PROGRAM_ID;

export type SapKeypair = import('@solana/web3.js').Keypair;
export type SapClient = import('@oobe-protocol-labs/synapse-sap-sdk').SapClient;
export type Capability = import('@oobe-protocol-labs/synapse-sap-sdk').Capability;

/** Load a Solana keypair as the SDK-consistent (CJS) Keypair class. */
export function loadSapKeypair(keypairPath: string): SapKeypair {
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
