import {
  Horizon,
  Keypair,
  Networks,
  TransactionBuilder,
  BASE_FEE,
} from '@stellar/stellar-sdk';

export const HORIZON_URL =
  process.env.HORIZON_URL ?? 'https://horizon-testnet.stellar.org';
export const NETWORK_PASSPHRASE =
  process.env.NETWORK_PASSPHRASE ?? Networks.TESTNET;
export const FRIENDBOT_URL =
  process.env.FRIENDBOT_URL ?? 'https://friendbot.stellar.org';

export const server = new Horizon.Server(HORIZON_URL);

/** Create a keypair and fund it from friendbot. */
export async function fundedKeypair(label) {
  const kp = Keypair.random();
  const res = await fetch(`${FRIENDBOT_URL}?addr=${kp.publicKey()}`);
  if (!res.ok) {
    throw new Error(
      `friendbot failed for ${label} (${res.status}): ${await res.text()}`,
    );
  }
  log(`funded ${label}`, kp.publicKey());
  return kp;
}

/**
 * Build, sign and submit a transaction.
 * `ops` are appended in order; every signer in `signers` signs.
 */
export async function submit({ source, ops, signers, memo }) {
  const account = await server.loadAccount(source.publicKey());
  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  for (const op of ops) builder.addOperation(op);
  if (memo) builder.addMemo(memo);

  const tx = builder.setTimeout(60).build();
  for (const signer of signers ?? [source]) tx.sign(signer);

  const res = await server.submitTransaction(tx);
  return res.hash;
}

/** Balance of a specific asset on an account, as a string. '0' when no trustline. */
export async function balanceOf(publicKey, asset) {
  const account = await server.loadAccount(publicKey);
  const line = account.balances.find(
    (b) =>
      b.asset_code === asset.getCode() && b.asset_issuer === asset.getIssuer(),
  );
  return line?.balance ?? '0';
}

/** Raw account flags as Horizon reports them. */
export async function flagsOf(publicKey) {
  const account = await server.loadAccount(publicKey);
  return account.flags;
}

/** Whether a trustline is clawback enabled. Undefined when there is no trustline. */
export async function trustlineClawbackEnabled(publicKey, asset) {
  const account = await server.loadAccount(publicKey);
  const line = account.balances.find(
    (b) =>
      b.asset_code === asset.getCode() && b.asset_issuer === asset.getIssuer(),
  );
  return line?.is_clawback_enabled;
}

export function explorer(hash) {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}

export function log(step, detail = '') {
  console.log(`  ${step}${detail ? '  ' + detail : ''}`);
}

export function section(title) {
  console.log(`\n${title}`);
}

export function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`  ✓ ${message}`);
}

/** Whether a trustline is authorized. Undefined when there is no trustline. */
export async function trustlineAuthorized(publicKey, asset) {
  const account = await server.loadAccount(publicKey);
  const line = account.balances.find(
    (b) =>
      b.asset_code === asset.getCode() && b.asset_issuer === asset.getIssuer(),
  );
  return line?.is_authorized;
}
