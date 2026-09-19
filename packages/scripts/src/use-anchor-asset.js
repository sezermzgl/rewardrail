/**
 * Move the demo onto the anchor's asset, so the payout has a real fiat exit.
 *
 * TUSDC was ours: fine for proving the mechanism, useless at the edge, because
 * no anchor recognises an asset we minted. Circle's testnet USDC is what the
 * Turkish anchor ramps against TRY, so switching to it is what turns "the
 * player is paid" into "the player is paid in something they can take to a
 * bank account".
 *
 * Everything else is unchanged. The escrow holds whatever token address a
 * campaign names, which is why this is a setup script and not a rewrite.
 *
 * Run: npm run use-anchor-asset
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { Keypair, Asset, Operation, TransactionBuilder, BASE_FEE } from '@stellar/stellar-sdk';

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
const read = (f) => JSON.parse(readFileSync(join(HERE, '..', f), 'utf8'));
const DEPLOY_PATH = join(HERE, '..', 'deployed.json');

const HOME_DOMAIN = process.env.ANCHOR_HOME_DOMAIN ?? 'tr-mock-anchor.fly.dev';
const ASSET_CODE = process.env.ANCHOR_ASSET_CODE ?? 'USDC';
const SOROBAN_RPC_URL =
  process.env.SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org';

/** Small on purpose: the faucet gives 20 USDC every two hours. */
const UNIT = 10_000_000n;
const PER_ACTION = 4n * UNIT;
const BUDGET = 12n * UNIT;
const SPLIT = { player_bps: 3000, publisher_bps: 4500, platform_bps: 2500 };

/** The asset the anchor names in its own toml — never hardcoded here. */
async function anchorAsset() {
  const res = await fetch(`https://${HOME_DOMAIN}/.well-known/stellar.toml`);
  const text = await res.text();
  const currency = text
    .split('[[CURRENCIES]]')
    .slice(1)
    .map((b) => ({
      code: b.match(/code\s*=\s*"([^"]+)"/)?.[1],
      issuer: b.match(/issuer\s*=\s*"([^"]+)"/)?.[1],
    }))
    .find((c) => c.code === ASSET_CODE);
  if (!currency?.issuer) throw new Error(`${ASSET_CODE} is not in the anchor's toml`);
  return new Asset(currency.code, currency.issuer);
}

async function hasTrustline(publicKey, asset) {
  const account = await server.loadAccount(publicKey);
  return account.balances.some(
    (b) => b.asset_code === asset.getCode() && b.asset_issuer === asset.getIssuer(),
  );
}

/** A funded account opens its own trustline. */
async function openTrustline(keypair, asset, label) {
  if (await hasTrustline(keypair.publicKey(), asset)) {
    log(`${label} already trusts ${asset.getCode()}`);
    return;
  }
  const hash = await submit({ source: keypair, ops: [Operation.changeTrust({ asset })] });
  log(`${label} trustline`, explorer(hash));
}

/**
 * A player holds no XLM, so the sponsor pays the reserve and the fee. Same
 * shape as signup: the player signs for its own trustline, the sponsor pays
 * for its existence.
 */
async function openSponsoredTrustline(player, sponsor, asset, label) {
  if (await hasTrustline(player.publicKey(), asset)) {
    log(`${label} already trusts ${asset.getCode()}`);
    return;
  }
  const account = await server.loadAccount(sponsor.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(Operation.beginSponsoringFutureReserves({ sponsoredId: player.publicKey() }))
    .addOperation(Operation.changeTrust({ asset, source: player.publicKey() }))
    .addOperation(Operation.endSponsoringFutureReserves({ source: player.publicKey() }))
    .setTimeout(60)
    .build();
  tx.sign(sponsor);
  tx.sign(player);
  const res = await server.submitTransaction(tx);
  log(`${label} trustline (sponsored)`, explorer(res.hash));
}

function deploySac(asset, sourceSecret) {
  const deployed = existsSync(DEPLOY_PATH) ? JSON.parse(readFileSync(DEPLOY_PATH, 'utf8')) : {};
  if (deployed.anchorSac) {
    log('SAC already deployed', deployed.anchorSac);
    return deployed.anchorSac;
  }

  // The SAC may already exist on chain — anyone can deploy it, and for a
  // widely used asset someone already has. A failure here is expected in
  // that case, so fall back to asking the CLI for the deterministic id.
  let id;
  const common = [
    '--rpc-url', SOROBAN_RPC_URL,
    '--network-passphrase', NETWORK_PASSPHRASE,
  ];
  try {
    id = execFileSync(
      'stellar',
      ['contract', 'asset', 'deploy', '--asset', `${asset.getCode()}:${asset.getIssuer()}`,
       '--source-account', sourceSecret, ...common],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ).trim();
    log('SAC deployed', id);
  } catch {
    id = execFileSync(
      'stellar',
      ['contract', 'id', 'asset', '--asset', `${asset.getCode()}:${asset.getIssuer()}`, ...common],
      { encoding: 'utf8' },
    ).trim();
    log('SAC already existed', id);
  }

  writeFileSync(DEPLOY_PATH, JSON.stringify({ ...deployed, anchorSac: id }, null, 2) + '\n');
  return id;
}

async function main() {
  console.log(`RewardRail — switching the demo onto ${HOME_DOMAIN}'s asset\n`);

  const keys = Object.fromEntries(
    Object.entries(read('keys.json')).map(([k, v]) => [k, Keypair.fromSecret(v)]),
  );
  const players = Object.fromEntries(
    Object.entries(read('players.json')).map(([k, v]) => [k, Keypair.fromSecret(v)]),
  );

  const asset = await anchorAsset();
  section('ASSET');
  log(asset.getCode(), `issued by ${asset.getIssuer()}`);

  const held = Number(await balanceOf(keys.advertiser.publicKey(), asset));
  assert(
    held >= Number(BUDGET / UNIT),
    `advertiser holds ${held} ${asset.getCode()} (need ${BUDGET / UNIT})`,
  );

  section('TRUSTLINES');
  await openTrustline(keys.publisher, asset, 'publisher');
  await openTrustline(keys.platform, asset, 'platform');
  for (const [label, kp] of Object.entries(players)) {
    await openSponsoredTrustline(kp, keys.sponsor, asset, label);
  }

  section('STELLAR ASSET CONTRACT');
  const sac = deploySac(asset, keys.advertiser.secret());
  assert(/^C[A-Z2-7]{55}$/.test(sac), 'SAC id looks well formed');

  section('CAMPAIGN');
  const { escrow } = read('deployed.json');
  const splits = JSON.stringify({ [keys.publisher.publicKey()]: SPLIT });
  const campaignId = execFileSync(
    'stellar',
    [
      'contract', 'invoke', '--id', escrow,
      '--source-account', keys.advertiser.secret(),
      '--rpc-url', SOROBAN_RPC_URL,
      '--network-passphrase', NETWORK_PASSPHRASE,
      '--', 'open_campaign',
      '--advertiser', keys.advertiser.publicKey(),
      '--platform', keys.platform.publicKey(),
      '--token_address', sac,
      '--validator', Buffer.from(keys.validator.rawPublicKey()).toString('hex'),
      '--per_action', PER_ACTION.toString(),
      '--budget', BUDGET.toString(),
      '--splits', splits,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();

  log('campaign', campaignId);
  log('funded with', `${BUDGET / UNIT} ${asset.getCode()}`);

  section('READY');
  console.log(`  ANCHOR_HOME_DOMAIN=${HOME_DOMAIN}`);
  console.log(`  ANCHOR_ASSET_CODE=${ASSET_CODE}`);
  console.log(`  DEMO_CAMPAIGN_ID=${campaignId}`);
  console.log('\n  The payout now settles in an asset the anchor will convert to TRY.\n');
}

main().catch((err) => {
  console.error('\nFAILED:', err.message);
  if (err.stderr) console.error(err.stderr.toString().slice(0, 800));
  process.exit(1);
});
