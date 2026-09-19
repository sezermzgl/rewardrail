/**
 * Brings every account the demo needs to a usable state on testnet.
 *
 * Generates keypairs, funds them from friendbot, sets the issuer flags that
 * clawback depends on, and verifies those flags before anything else can
 * create a trustline against them.
 *
 * Idempotent: if keys.json already exists the same accounts are reused, so
 * running this twice does not orphan a half-configured issuer.
 *
 * Run: npm run bootstrap
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  Keypair,
  Operation,
  AuthRevocableFlag,
  AuthClawbackEnabledFlag,
} from '@stellar/stellar-sdk';

import {
  server,
  fundedKeypair,
  submit,
  flagsOf,
  explorer,
  log,
  section,
  assert,
} from './stellar.js';

const KEYS_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'keys.json');

/**
 * Every account the demo needs. Players are deliberately absent: they are
 * created at signup through the sponsored flow, never funded directly.
 */
const ROLES = [
  ['rewardIssuer', 'issues REWARD, holds clawback authority'],
  ['tusdcIssuer', 'issues the TUSDC test stablecoin'],
  ['sponsor', 'sponsors player reserves and pays fees'],
  ['validator', 'signs action proofs, holds no funds'],
  ['advertiser', 'funds campaigns'],
  ['publisher', 'receives publisher shares'],
  ['platform', 'takes the platform share, authorizes clawback refunds'],
];

function loadKeys() {
  if (!existsSync(KEYS_PATH)) return null;
  const raw = JSON.parse(readFileSync(KEYS_PATH, 'utf8'));
  return Object.fromEntries(
    Object.entries(raw).map(([role, secret]) => [role, Keypair.fromSecret(secret)]),
  );
}

function saveKeys(keys) {
  const raw = Object.fromEntries(
    Object.entries(keys).map(([role, kp]) => [role, kp.secret()]),
  );
  writeFileSync(KEYS_PATH, JSON.stringify(raw, null, 2) + '\n');
}

async function ensureAccounts() {
  const existing = loadKeys();
  if (existing) {
    section('ACCOUNTS — reusing keys.json');
    let added = false;
    for (const [role, purpose] of ROLES) {
      // Roles added after the first run are filled in rather than forcing a
      // regeneration, which would orphan the already-configured issuer.
      if (!existing[role]) {
        existing[role] = await fundedKeypair(`${role.padEnd(14)} (${purpose}, new)`);
        added = true;
        continue;
      }
      await server.loadAccount(existing[role].publicKey());
      log(role.padEnd(14), existing[role].publicKey());
    }
    if (added) {
      saveKeys(existing);
      log('updated', KEYS_PATH);
    }
    return existing;
  }

  section('ACCOUNTS — generating and funding');
  const keys = {};
  for (const [role, purpose] of ROLES) {
    keys[role] = await fundedKeypair(`${role.padEnd(14)} (${purpose})`);
  }
  saveKeys(keys);
  log('wrote', KEYS_PATH);
  return keys;
}

/**
 * Set AUTH_REVOCABLE and AUTH_CLAWBACK_ENABLED on the REWARD issuer.
 *
 * This must happen before any trustline to REWARD exists. A trustline is
 * marked clawback enabled from the issuer's flags at creation time, and
 * setting the flag later does not reach trustlines that already exist.
 * prove-clawback.js demonstrates both outcomes.
 */
async function configureRewardIssuer(issuer) {
  section('REWARD ISSUER FLAGS');

  const before = await flagsOf(issuer.publicKey());
  if (before.auth_revocable && before.auth_clawback_enabled) {
    log('already configured, skipping');
  } else {
    const hash = await submit({
      source: issuer,
      ops: [
        Operation.setOptions({
          setFlags: AuthRevocableFlag | AuthClawbackEnabledFlag,
        }),
      ],
    });
    log('flags set', explorer(hash));
  }

  const after = await flagsOf(issuer.publicKey());
  assert(after.auth_revocable, 'auth_revocable is set');
  assert(after.auth_clawback_enabled, 'auth_clawback_enabled is set');
  assert(!after.auth_immutable, 'auth_immutable is NOT set (flags stay changeable)');
}

/**
 * Fail loudly if anything already trusts REWARD. Reaching this state means
 * the issuer was used before its flags were verified, and every trustline
 * created in that window is permanently non-clawbackable.
 */
async function assertNoPreexistingTrustlines(issuer) {
  const { records } = await server
    .assets()
    .forCode('REWARD')
    .forIssuer(issuer.publicKey())
    .call();

  const accounts = records[0]?.accounts;
  const trusted = accounts
    ? accounts.authorized + accounts.authorized_to_maintain_liabilities + accounts.unauthorized
    : 0;

  assert(trusted === 0, 'no REWARD trustline predates the flags');
}

async function main() {
  console.log('RewardRail — testnet bootstrap');

  const keys = await ensureAccounts();
  await configureRewardIssuer(keys.rewardIssuer);
  await assertNoPreexistingTrustlines(keys.rewardIssuer);

  section('ENV — copy into .env');
  console.log(`REWARD_ISSUER=${keys.rewardIssuer.publicKey()}`);
  console.log(`TUSDC_ISSUER=${keys.tusdcIssuer.publicKey()}`);
  console.log(`SPONSOR=${keys.sponsor.publicKey()}`);
  console.log(`VALIDATOR=${keys.validator.publicKey()}`);
  console.log(`ADVERTISER=${keys.advertiser.publicKey()}`);
  console.log(`PUBLISHER=${keys.publisher.publicKey()}`);

  section('READY');
  console.log('  Secrets are in keys.json, which is gitignored.');
  console.log('  Next: npm run issue-assets\n');
}

main().catch((err) => {
  console.error('\nFAILED:', err.message);
  const extras = err?.response?.data?.extras;
  if (extras) console.error('result_codes:', JSON.stringify(extras.result_codes));
  process.exit(1);
});
