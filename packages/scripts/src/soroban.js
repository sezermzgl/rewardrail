/**
 * Soroban RPC access for the scripts package.
 *
 * Deliberately built on @stellar/stellar-sdk rather than shelling out to the
 * `stellar` CLI: the validator (#10, #12) has to invoke contracts from Node
 * anyway, so this is the same code path rather than a second one.
 */
import {
  rpc,
  Operation,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
} from '@stellar/stellar-sdk';

import { NETWORK_PASSPHRASE } from './stellar.js';

export const SOROBAN_RPC_URL =
  process.env.SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org';

export const soroban = new rpc.Server(SOROBAN_RPC_URL);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Classic asset amounts carry 7 decimals; Soroban sees the integer stroops. */
export const STROOPS = 10_000_000n;
export const toStroops = (amount) => BigInt(Math.round(Number(amount) * 1e7));

export const addr = (publicKey) => nativeToScVal(publicKey, { type: 'address' });
export const i128 = (amount) => nativeToScVal(toStroops(amount), { type: 'i128' });

/**
 * Simulate, sign and submit a Soroban transaction, then wait for the ledger to
 * include it. Every failure mode — simulation, submission, execution — surfaces
 * as a thrown Error, because a caller that wants to tolerate one should say so.
 */
async function send({ source, op, signers }) {
  const account = await soroban.getAccount(source.publicKey());

  const built = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(60)
    .build();

  // prepareTransaction simulates and attaches the resource footprint and fee.
  // A contract-level rejection shows up here, before anything is submitted.
  const prepared = await soroban.prepareTransaction(built);
  for (const signer of signers ?? [source]) prepared.sign(signer);

  const sent = await soroban.sendTransaction(prepared);
  if (sent.status === 'ERROR') {
    throw new Error(`submission rejected: ${JSON.stringify(sent.errorResult)}`);
  }

  for (let attempt = 0; attempt < 30; attempt++) {
    const got = await soroban.getTransaction(sent.hash);
    if (got.status === 'NOT_FOUND') {
      await sleep(1000);
      continue;
    }
    if (got.status !== 'SUCCESS') {
      throw new Error(`execution failed: ${got.status}`);
    }
    return {
      hash: sent.hash,
      value: got.returnValue ? scValToNative(got.returnValue) : undefined,
    };
  }
  throw new Error(`transaction ${sent.hash} never landed`);
}

/** Deploy the Stellar Asset Contract wrapper for a classic asset. */
export async function deploySac(asset, source) {
  return send({ source, op: Operation.createStellarAssetContract({ asset }) });
}

/** Call a function on a deployed contract. */
export async function invoke({ contractId, fn, args = [], source, signers }) {
  return send({
    source,
    signers,
    op: Operation.invokeContractFunction({ contract: contractId, function: fn, args }),
  });
}
