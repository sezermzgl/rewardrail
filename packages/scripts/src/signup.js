/**
 * Player signup: an account that can hold rewards while owning no XLM.
 *
 * Two things are proven here, and both are load-bearing for the pitch.
 *
 * 1. The player never funds anything. The account is created with a zero
 *    starting balance and its reserves are paid by the sponsor, so signup
 *    costs the player nothing and asks them for nothing.
 * 2. A zero-XLM account can still transact. The player signs, the sponsor
 *    wraps the transaction in a fee bump and pays the fee.
 *
 * Together these are why the player panel can avoid the words wallet, seed
 * and gas entirely.
 *
 * Run: npm run signup
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  Keypair,
  Asset,
  Operation,
  TransactionBuilder,
  BASE_FEE,
} from '@stellar/stellar-sdk';

import {
  server,
  submit,
  trustlineAuthorized,
  balanceOf,
  trustlineClawbackEnabled,
  explorer,
  log,
  section,
  assert,
  NETWORK_PASSPHRASE,
} from './stellar.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const KEYS_PATH = join(HERE, '..', 'keys.json');
const PLAYERS_PATH = join(HERE, '..', 'players.json');

function loadKeys() {
  if (!existsSync(KEYS_PATH)) {
    throw new Error('keys.json not found — run `npm run bootstrap` first');
  }
  const raw = JSON.parse(readFileSync(KEYS_PATH, 'utf8'));
  return Object.fromEntries(
    Object.entries(raw).map(([role, secret]) => [role, Keypair.fromSecret(secret)]),
  );
}

function savePlayer(label, kp) {
  const all = existsSync(PLAYERS_PATH)
    ? JSON.parse(readFileSync(PLAYERS_PATH, 'utf8'))
    : {};
  all[label] = kp.secret();
  writeFileSync(PLAYERS_PATH, JSON.stringify(all, null, 2) + '\n');
}

/**
 * One transaction does everything: sponsor the reserves, create the account
 * with nothing in it, open both trustlines, close the sponsorship.
 *
 * The inner transaction is sourced by the sponsor because the player account
 * does not exist yet and therefore has no sequence number. Both parties sign:
 * the sponsor for the sponsorship and creation, the player for its own
 * trustlines and for accepting the sponsorship.
 */
async function createSponsoredPlayer(keys, label) {
  const player = Keypair.random();
  const reward = new Asset('REWARD', keys.rewardIssuer.publicKey());
  const tusdc = new Asset('TUSDC', keys.tusdcIssuer.publicKey());

  const hash = await submit({
    source: keys.sponsor,
    signers: [keys.sponsor, player, keys.rewardIssuer],
    ops: [
      Operation.beginSponsoringFutureReserves({ sponsoredId: player.publicKey() }),
      Operation.createAccount({
        destination: player.publicKey(),
        startingBalance: '0',
      }),
      Operation.changeTrust({ asset: reward, source: player.publicKey() }),
      Operation.changeTrust({ asset: tusdc, source: player.publicKey() }),
      Operation.endSponsoringFutureReserves({ source: player.publicKey() }),
      // The issuer has AUTH_REQUIRED, so a fresh REWARD trustline starts
      // unauthorized and cannot receive anything. Authorizing it here is what
      // makes a reward payable to this account and nothing else.
      Operation.setTrustLineFlags({
        trustor: player.publicKey(),
        asset: reward,
        flags: { authorized: true },
        source: keys.rewardIssuer.publicKey(),
      }),
    ],
  });

  log(`${label} created`, explorer(hash));
  savePlayer(label, player);
  return { player, reward, tusdc };
}

async function assertPlayerIsWeightless(player, reward, tusdc) {
  const account = await server.loadAccount(player.publicKey());
  const xlm = account.balances.find((b) => b.asset_type === 'native');

  assert(xlm?.balance === '0.0000000', 'player holds zero XLM');
  assert(
    Number(account.subentry_count) === 2,
    'player has two trustlines and pays for neither',
  );
  assert(
    (await trustlineClawbackEnabled(player.publicKey(), reward)) === true,
    'REWARD trustline is clawback enabled',
  );
  assert(
    (await trustlineAuthorized(player.publicKey(), reward)) === true,
    'REWARD trustline was authorized by the issuer',
  );
  // Horizon omits the field entirely when the flag is off, so this reads
  // `!== true` rather than `=== false`.
  assert(
    (await trustlineClawbackEnabled(player.publicKey(), tusdc)) !== true,
    'TUSDC trustline is not clawback enabled',
  );
}

/**
 * Prove a zero-XLM account can transact.
 *
 * The inner transaction is sourced and signed by the player, so it would
 * normally need the player to hold XLM for the fee. The sponsor wraps it in
 * a fee bump and pays instead. This is the mechanism behind every player
 * action in the demo.
 */
async function proveFeeBump(keys, player, reward) {
  const account = await server.loadAccount(player.publicKey());

  const inner = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    // Any player-sourced operation demonstrates the point; raising the REWARD
    // trust limit is one the player would plausibly trigger.
    .addOperation(Operation.changeTrust({ asset: reward, limit: '1000000' }))
    .setTimeout(60)
    .build();
  inner.sign(player);

  const bumped = TransactionBuilder.buildFeeBumpTransaction(
    keys.sponsor,
    BASE_FEE,
    inner,
    NETWORK_PASSPHRASE,
  );
  bumped.sign(keys.sponsor);

  const res = await server.submitTransaction(bumped);
  log('fee-bumped player transaction', explorer(res.hash));

  const after = await server.loadAccount(player.publicKey());
  const xlm = after.balances.find((b) => b.asset_type === 'native');
  assert(xlm?.balance === '0.0000000', 'player still holds zero XLM after transacting');
}

async function main() {
  console.log('RewardRail — sponsored player signup');

  const keys = loadKeys();

  section('SIGNUP — two players, as the demo needs');
  const honest = await createSponsoredPlayer(keys, 'honest');
  const fraudster = await createSponsoredPlayer(keys, 'fraudster');

  section('THE PLAYER OWNS NOTHING AND OWES NOTHING');
  await assertPlayerIsWeightless(honest.player, honest.reward, honest.tusdc);

  section('A ZERO BALANCE ACCOUNT CAN STILL TRANSACT');
  await proveFeeBump(keys, honest.player, honest.reward);

  section('READY');
  console.log(`  honest     ${honest.player.publicKey()}`);
  console.log(`  fraudster  ${fraudster.player.publicKey()}`);
  console.log('  Secrets are in players.json, which is gitignored.\n');
}

main().catch((err) => {
  console.error('\nFAILED:', err.message);
  const extras = err?.response?.data?.extras;
  if (extras) console.error('result_codes:', JSON.stringify(extras.result_codes));
  process.exit(1);
});
