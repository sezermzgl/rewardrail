/**
 * Everything that touches Stellar: classic operations through Horizon and
 * contract calls through Soroban RPC.
 */
import {
  Horizon,
  rpc,
  Contract,
  Keypair,
  TransactionBuilder,
  Operation,
  Memo,
  Address,
  nativeToScVal,
  scValToNative,
  xdr,
  BASE_FEE,
} from '@stellar/stellar-sdk';

import { config, keys, REWARD, TUSDC } from './config.js';

export const horizon = new Horizon.Server(config.horizonUrl);
export const soroban = new rpc.Server(config.sorobanRpcUrl);

const escrow = () => new Contract(config.escrowId);

export const explorer = (hash) =>
  `https://stellar.expert/explorer/testnet/tx/${hash}`;

/* ------------------------------------------------------------------ *
 * Classic
 * ------------------------------------------------------------------ */

export async function submitClassic({ source, ops, signers }) {
  const account = await horizon.loadAccount(source.publicKey());
  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  });
  for (const op of ops) builder.addOperation(op);
  const tx = builder.setTimeout(60).build();
  for (const signer of signers ?? [source]) tx.sign(signer);
  const res = await horizon.submitTransaction(tx);
  return res.hash;
}

/**
 * Submit a transaction a player triggered.
 *
 * The player is the source but holds no XLM, so the sponsor wraps it in a fee
 * bump and pays. This is what lets the player panel never mention a fee.
 */
export async function submitAsPlayer({ player, sponsor, ops, memo, memoType }) {
  const account = await horizon.loadAccount(player.publicKey());
  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  });
  for (const op of ops) builder.addOperation(op);

  // An anchor matches an incoming payment to a withdrawal by its memo, so
  // sending without one loses the money in their treasury.
  if (memo !== undefined && memo !== null) {
    builder.addMemo(memoType === 'id' ? Memo.id(String(memo)) : Memo.text(String(memo)));
  }

  const inner = builder.setTimeout(60).build();
  inner.sign(player);

  const bumped = TransactionBuilder.buildFeeBumpTransaction(
    sponsor,
    BASE_FEE,
    inner,
    config.networkPassphrase,
  );
  bumped.sign(sponsor);
  const res = await horizon.submitTransaction(bumped);
  return res.hash;
}

export async function assetBalance(publicKey, asset) {
  const account = await horizon.loadAccount(publicKey);
  const line = account.balances.find(
    (b) => b.asset_code === asset.getCode() && b.asset_issuer === asset.getIssuer(),
  );
  return line?.balance ?? '0';
}

export function payment({ destination, asset, amount, source }) {
  return Operation.payment({ destination, asset, amount, source });
}

export function clawback({ from, asset, amount }) {
  return Operation.clawback({ from, asset, amount });
}

/**
 * Freeze or unfreeze a trustline.
 *
 * Revoking authorization is what makes the clawback window real. A frozen
 * balance is visible to its holder but cannot move — not to a second account,
 * not to an exchange, not anywhere. Without this the window is advisory: a
 * player could simply forward the reward out of reach and convert from there.
 *
 * `clawbackEnabled` is deliberately left untouched. Clearing it here would
 * quietly and permanently disarm clawback on that trustline.
 */
export function setTrustline({ trustor, asset, authorized }) {
  return Operation.setTrustLineFlags({ trustor, asset, flags: { authorized } });
}

export function pathPaymentStrictSend({ sendAsset, sendAmount, destination, destAsset }) {
  return Operation.pathPaymentStrictSend({
    sendAsset,
    sendAmount,
    destination,
    destAsset,
    destMin: sendAmount,
    path: [],
  });
}

/* ------------------------------------------------------------------ *
 * Soroban
 * ------------------------------------------------------------------ */

export const sc = {
  u64: (v) => nativeToScVal(BigInt(v), { type: 'u64' }),
  i128: (v) => nativeToScVal(BigInt(v), { type: 'i128' }),
  address: (pk) => new Address(pk).toScVal(),
  bytes: (buf) => xdr.ScVal.scvBytes(Buffer.from(buf)),
};

/** Read-only contract call. Simulated, never submitted, so it costs nothing. */
export async function readContract(method, args = []) {
  const account = await horizon.loadAccount(simulationSource().publicKey());

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(escrow().call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await soroban.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`simulation failed for ${method}: ${sim.error}`);
  }
  return scValToNative(sim.result.retval);
}

/** Write contract call: simulate, sign, submit, wait for the result. */
export async function invokeContract(method, args, signer) {
  const account = await horizon.loadAccount(signer.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(escrow().call(method, ...args))
    .setTimeout(60)
    .build();

  const prepared = await soroban.prepareTransaction(tx);
  prepared.sign(signer);

  const sent = await soroban.sendTransaction(prepared);
  if (sent.status === 'ERROR') {
    throw new Error(`${method} rejected: ${JSON.stringify(sent.errorResult)}`);
  }

  // Poll rather than sleep-and-hope; testnet is usually one or two ledgers.
  let result = await soroban.getTransaction(sent.hash);
  const deadline = Date.now() + 45_000;
  while (result.status === 'NOT_FOUND' && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1000));
    result = await soroban.getTransaction(sent.hash);
  }

  if (result.status !== 'SUCCESS') {
    throw new Error(`${method} failed on chain: ${result.status}`);
  }
  return {
    hash: sent.hash,
    value: result.returnValue ? scValToNative(result.returnValue) : null,
  };
}

/**
 * Invoke the contract as the player, without the player holding any XLM.
 *
 * Soroban treats the transaction source account as implicitly authorized, so
 * a `require_auth()` on the player is satisfied by the player's signature on
 * the transaction itself — no separate authorization entry needed. The
 * sponsor then fee-bumps the whole thing, which is what lets a zero-balance
 * account withdraw its own money.
 */
export async function invokeContractAsPlayer(method, args, player, sponsor) {
  const account = await horizon.loadAccount(player.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(escrow().call(method, ...args))
    .setTimeout(60)
    .build();

  const prepared = await soroban.prepareTransaction(tx);
  prepared.sign(player);

  // prepareTransaction raises the inner fee to cover the resource cost, and
  // the bump has to bid at least that much. Bidding above the minimum is
  // free: Stellar charges what the ledger requires, not what was offered.
  const bumped = TransactionBuilder.buildFeeBumpTransaction(
    sponsor,
    (BigInt(prepared.fee) + 1_000_000n).toString(),
    prepared,
    config.networkPassphrase,
  );
  bumped.sign(sponsor);

  const sent = await soroban.sendTransaction(bumped);
  if (sent.status === 'ERROR') {
    throw new Error(`${method} rejected: ${JSON.stringify(sent.errorResult)}`);
  }

  let result = await soroban.getTransaction(sent.hash);
  const deadline = Date.now() + 45_000;
  while (result.status === 'NOT_FOUND' && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1000));
    result = await soroban.getTransaction(sent.hash);
  }
  if (result.status !== 'SUCCESS') {
    throw new Error(`${method} failed on chain: ${result.status}`);
  }
  return {
    hash: sent.hash,
    value: result.returnValue ? scValToNative(result.returnValue) : null,
  };
}

/**
 * Simulation needs some existing account as a transaction source. The
 * validator holds no funds but does have an account, which is enough, and
 * nothing is ever submitted from a simulation.
 */
function simulationSource() {
  return keys.validator;
}

/**
 * Open a player account that owns nothing and owes nothing.
 *
 * One transaction does all of it, paid and signed by the sponsor. The player
 * account is created with a zero starting balance — only legal under
 * sponsorship — and its two trustlines are paid for by the sponsor as well, so
 * signup costs the player nothing and asks them for nothing.
 *
 * The last operation matters as much as the rest: the REWARD issuer carries
 * AUTH_REQUIRED, so a fresh trustline starts unauthorized and cannot receive
 * anything. Authorizing it here is what makes a reward payable to this account.
 *
 * Signed by sponsor, player and issuer. The player's key was generated a line
 * earlier in this process, which is what lets the player sign nothing.
 */
export async function createSponsoredPlayer() {
  const player = Keypair.random();

  const hash = await submitClassic({
    source: keys.sponsor,
    signers: [keys.sponsor, player, keys.rewardIssuer],
    ops: [
      Operation.beginSponsoringFutureReserves({ sponsoredId: player.publicKey() }),
      Operation.createAccount({ destination: player.publicKey(), startingBalance: '0' }),
      Operation.changeTrust({ asset: REWARD, source: player.publicKey() }),
      Operation.changeTrust({ asset: TUSDC, source: player.publicKey() }),
      Operation.endSponsoringFutureReserves({ source: player.publicKey() }),
      Operation.setTrustLineFlags({
        trustor: player.publicKey(),
        asset: REWARD,
        flags: { authorized: true },
        source: keys.rewardIssuer.publicKey(),
      }),
    ],
  });

  return { player, hash };
}
