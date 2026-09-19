/**
 * Creates the two demo assets and makes TUSDC reachable from a Soroban contract.
 *
 * TUSDC stands in for USDC. We issue our own rather than depending on a testnet
 * USDC issuer and faucet, because an external dependency that fails mid-demo is
 * a risk not worth taking. Architecturally they are the same thing: a classic
 * asset wrapped as a Stellar Asset Contract.
 *
 * REWARD is not minted here. It is minted per payout, and its trustlines are
 * created at player signup so they inherit the issuer's clawback flag.
 *
 * Run: npm run issue-assets
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { Keypair, Asset, Operation } from '@stellar/stellar-sdk';

import {
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
const DEPLOY_PATH = join(HERE, '..', 'deployed.json');

const SOROBAN_RPC_URL =
  process.env.SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org';

/** Enough TUSDC to run the demo many times over without re-minting. */
const ADVERTISER_FUNDING = '100000';

function loadKeys() {
  if (!existsSync(KEYS_PATH)) {
    throw new Error('keys.json not found — run `npm run bootstrap` first');
  }
  const raw = JSON.parse(readFileSync(KEYS_PATH, 'utf8'));
  return Object.fromEntries(
    Object.entries(raw).map(([role, secret]) => [role, Keypair.fromSecret(secret)]),
  );
}

function readDeployed() {
  return existsSync(DEPLOY_PATH) ? JSON.parse(readFileSync(DEPLOY_PATH, 'utf8')) : {};
}

function writeDeployed(patch) {
  const next = { ...readDeployed(), ...patch };
  writeFileSync(DEPLOY_PATH, JSON.stringify(next, null, 2) + '\n');
  return next;
}

/** Create a trustline only when it is missing, so reruns stay cheap. */
async function ensureTrustline(holder, asset, label) {
  const current = await balanceOf(holder.publicKey(), asset);
  if (current !== '0' || (await hasTrustline(holder, asset))) {
    log(`${label} already trusts ${asset.getCode()}`);
    return;
  }
  const hash = await submit({
    source: holder,
    ops: [Operation.changeTrust({ asset })],
  });
  log(`${label} trustline`, explorer(hash));
}

async function hasTrustline(holder, asset) {
  const { server } = await import('./stellar.js');
  const account = await server.loadAccount(holder.publicKey());
  return account.balances.some(
    (b) => b.asset_code === asset.getCode() && b.asset_issuer === asset.getIssuer(),
  );
}

async function issueTusdc(keys) {
  section('TUSDC — trustlines and supply');

  const TUSDC = new Asset('TUSDC', keys.tusdcIssuer.publicKey());

  await ensureTrustline(keys.advertiser, TUSDC, 'advertiser');
  await ensureTrustline(keys.publisher, TUSDC, 'publisher');

  const held = await balanceOf(keys.advertiser.publicKey(), TUSDC);
  if (Number(held) >= Number(ADVERTISER_FUNDING)) {
    log(`advertiser already funded with ${held} TUSDC`);
  } else {
    const hash = await submit({
      source: keys.tusdcIssuer,
      ops: [
        Operation.payment({
          destination: keys.advertiser.publicKey(),
          asset: TUSDC,
          amount: ADVERTISER_FUNDING,
        }),
      ],
    });
    log('minted to advertiser', explorer(hash));
  }

  assert(
    Number(await balanceOf(keys.advertiser.publicKey(), TUSDC)) > 0,
    'advertiser holds TUSDC',
  );

  return TUSDC;
}

/**
 * Deploy the Stellar Asset Contract for a classic asset.
 *
 * A Soroban contract cannot hold a classic asset directly; it holds the SAC
 * wrapper. Deploying the same asset twice fails, so an existing id is reused.
 */
function deploySac(asset, sourceSecret, label) {
  const existing = readDeployed()[label];
  if (existing) {
    log(`${label} already deployed`, existing);
    return existing;
  }

  const args = [
    'contract',
    'asset',
    'deploy',
    '--asset',
    `${asset.getCode()}:${asset.getIssuer()}`,
    '--source-account',
    sourceSecret,
    '--rpc-url',
    SOROBAN_RPC_URL,
    '--network-passphrase',
    NETWORK_PASSPHRASE,
  ];

  const contractId = execFileSync('stellar', args, { encoding: 'utf8' }).trim();
  log(`${label} deployed`, contractId);
  writeDeployed({ [label]: contractId });
  return contractId;
}

async function main() {
  console.log('RewardRail — issue assets and deploy the TUSDC SAC');

  const keys = loadKeys();
  const TUSDC = await issueTusdc(keys);

  section('STELLAR ASSET CONTRACT');
  const tusdcSac = deploySac(TUSDC, keys.tusdcIssuer.secret(), 'tusdcSac');
  assert(/^C[A-Z2-7]{55}$/.test(tusdcSac), 'TUSDC SAC id looks well formed');

  section('ENV — copy into .env');
  console.log(`TUSDC_SAC_ID=${tusdcSac}`);

  section('READY');
  console.log(`  Contract ids are in deployed.json.`);
  console.log(`  Next: the escrow contract in packages/contracts\n`);
}

main().catch((err) => {
  console.error('\nFAILED:', err.message);
  const extras = err?.response?.data?.extras;
  if (extras) console.error('result_codes:', JSON.stringify(extras.result_codes));
  process.exit(1);
});
