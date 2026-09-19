/**
 * Fund the advertiser with USDC by putting Turkish lira in through an anchor.
 *
 * This is the on-ramp half of the product's claim: a campaign budget enters
 * as TRY from a bank account and lands as a Stellar asset the escrow can
 * hold. The bank is simulated — there is no real IBAN and no real money — but
 * the SEP flows and the USDC are real testnet ones, and the same code works
 * against a licensed anchor by changing the home domain.
 *
 * Run: npm run fund-from-anchor
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { Keypair, Asset, Operation, TransactionBuilder } from '@stellar/stellar-sdk';

import {
  server,
  submit,
  balanceOf,
  explorer,
  log,
  section,
  assert,
  NETWORK_PASSPHRASE,
} from './stellar.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const KEYS_PATH = join(HERE, '..', 'keys.json');

const HOME_DOMAIN = process.env.ANCHOR_HOME_DOMAIN ?? 'tr-mock-anchor.fly.dev';
const ASSET_CODE = process.env.ANCHOR_ASSET_CODE ?? 'USDC';
/** Turkish lira to send. The anchor converts at a live USD/TRY quote. */
const TRY_AMOUNT = process.env.TRY_AMOUNT ?? '20000';

function loadKeys() {
  if (!existsSync(KEYS_PATH)) {
    throw new Error('keys.json not found — run `npm run bootstrap` first');
  }
  const raw = JSON.parse(readFileSync(KEYS_PATH, 'utf8'));
  return Object.fromEntries(
    Object.entries(raw).map(([role, secret]) => [role, Keypair.fromSecret(secret)]),
  );
}

/** Everything is discovered from the toml, so only the domain is hardcoded. */
async function discover() {
  const res = await fetch(`https://${HOME_DOMAIN}/.well-known/stellar.toml`);
  if (!res.ok) throw new Error(`anchor toml unreachable (${res.status})`);
  const text = await res.text();
  const value = (key) => text.match(new RegExp(`^${key}\\s*=\\s*"([^"]+)"`, 'm'))?.[1];

  const currency = text
    .split('[[CURRENCIES]]')
    .slice(1)
    .map((block) => ({
      code: block.match(/code\s*=\s*"([^"]+)"/)?.[1],
      issuer: block.match(/issuer\s*=\s*"([^"]+)"/)?.[1],
    }))
    .find((c) => c.code === ASSET_CODE);

  if (!currency?.issuer) throw new Error(`${ASSET_CODE} is not listed in the anchor toml`);

  return {
    auth: value('WEB_AUTH_ENDPOINT'),
    sep6: value('TRANSFER_SERVER'),
    signingKey: value('SIGNING_KEY'),
    asset: new Asset(currency.code, currency.issuer),
  };
}

/** SEP-10. The account's own key is the identity; there is no password. */
async function authenticate(anchor, keypair) {
  const url = `${anchor.auth}?account=${keypair.publicKey()}&home_domain=${HOME_DOMAIN}`;
  const { transaction, network_passphrase } = await (await fetch(url)).json();

  const tx = TransactionBuilder.fromXDR(transaction, network_passphrase ?? NETWORK_PASSPHRASE);
  // Without this check any server answering on the right URL could collect
  // signatures from our accounts.
  assert(tx.source === anchor.signingKey, 'challenge came from the anchor in its toml');
  tx.sign(keypair);

  const body = await (
    await fetch(anchor.auth, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transaction: tx.toXDR() }),
    })
  ).json();
  if (!body.token) throw new Error(`SEP-10 failed: ${JSON.stringify(body)}`);
  return body.token;
}

async function ensureTrustline(keypair, asset) {
  const account = await server.loadAccount(keypair.publicKey());
  const has = account.balances.some(
    (b) => b.asset_code === asset.getCode() && b.asset_issuer === asset.getIssuer(),
  );
  if (has) {
    log('trustline already open');
    return;
  }
  const hash = await submit({ source: keypair, ops: [Operation.changeTrust({ asset })] });
  log('trustline opened', explorer(hash));
}

async function transactionStatus(anchor, id, token) {
  const res = await fetch(`${anchor.sep6}/transaction?id=${id}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  return body.transaction ?? {};
}

async function main() {
  console.log(`RewardRail — funding the advertiser with TRY through ${HOME_DOMAIN}\n`);

  const keys = loadKeys();
  const advertiser = keys.advertiser;
  const anchor = await discover();

  section('DISCOVERY');
  log('asset', `${anchor.asset.getCode()} issued by ${anchor.asset.getIssuer().slice(0, 8)}…`);
  log('auth', anchor.auth);
  log('transfer', anchor.sep6);

  section('TRUSTLINE');
  await ensureTrustline(advertiser, anchor.asset);

  section('AUTHENTICATE');
  const token = await authenticate(anchor, advertiser);
  log('SEP-10 session opened');

  section(`DEPOSIT — ${TRY_AMOUNT} TRY`);
  const url = new URL(`${anchor.sep6}/deposit`);
  url.searchParams.set('asset_code', anchor.asset.getCode());
  url.searchParams.set('account', advertiser.publicKey());
  url.searchParams.set('amount', TRY_AMOUNT);
  url.searchParams.set('type', 'bank_account');

  const started = await (
    await fetch(url, { headers: { authorization: `Bearer ${token}` } })
  ).json();
  if (!started.id) throw new Error(`deposit failed: ${JSON.stringify(started)}`);

  log('reference', started.instructions?.external_transfer_memo?.value ?? '—');
  log('iban', started.instructions?.bank_account_number?.value ?? '—');

  section('SIMULATE THE BANK TRANSFER');
  const sim = await fetch(`${anchor.sep6}/tx/${started.id}/simulate-bank-transfer`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ amount: TRY_AMOUNT }),
  });
  if (!sim.ok) throw new Error(`simulate failed (${sim.status}): ${await sim.text()}`);
  log('TRY credited, anchor is paying out');

  section('SETTLEMENT');
  const before = Number(await balanceOf(advertiser.publicKey(), anchor.asset));
  const deadline = Date.now() + 180_000;
  let tx = {};

  while (Date.now() < deadline) {
    tx = await transactionStatus(anchor, started.id, token);
    if (tx.status === 'completed' || tx.status === 'error') break;
    if (tx.status === 'pending_trust') {
      throw new Error('anchor is waiting on a trustline that should already exist');
    }
    await new Promise((r) => setTimeout(r, 5000));
  }

  if (tx.status !== 'completed') {
    throw new Error(`deposit did not complete — last status ${tx.status}: ${tx.message ?? ''}`);
  }

  log('rate', `${tx.amount_in} ${tx.amount_in_asset} → ${tx.amount_out} ${anchor.asset.getCode()}`);
  log('fee', `${tx.amount_fee} ${tx.amount_fee_asset}`);
  if (tx.stellar_transaction_id) log('stellar tx', explorer(tx.stellar_transaction_id));

  const after = Number(await balanceOf(advertiser.publicKey(), anchor.asset));
  assert(after > before, `advertiser holds ${after.toFixed(2)} ${anchor.asset.getCode()}`);

  section('READY');
  console.log('  A campaign budget can now be funded from Turkish lira.\n');
}

main().catch((err) => {
  console.error('\nFAILED:', err.message);
  process.exit(1);
});
