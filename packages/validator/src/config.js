/**
 * Configuration and key loading.
 *
 * Keys are read from the files the setup scripts produce. This is a hackathon
 * shortcut and an explicit one: in production the issuer and validator secrets
 * belong in a KMS, not on disk next to the service. The presentation says so.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { Keypair, Networks, Asset } from '@stellar/stellar-sdk';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = join(HERE, '..', '..', 'scripts');

function readJson(path, hint) {
  if (!existsSync(path)) {
    throw new Error(`${path} not found — ${hint}`);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

const rawKeys = readJson(
  join(SCRIPTS, 'keys.json'),
  'run `npm run bootstrap` in packages/scripts',
);
const rawPlayers = existsSync(join(SCRIPTS, 'players.json'))
  ? readJson(join(SCRIPTS, 'players.json'), '')
  : {};
const deployed = readJson(
  join(SCRIPTS, 'deployed.json'),
  'run `npm run deploy-escrow` in packages/scripts',
);

export const keys = Object.fromEntries(
  Object.entries(rawKeys).map(([role, secret]) => [role, Keypair.fromSecret(secret)]),
);

/**
 * Custodial player keys, held so the player never signs anything.
 * See docs/02-technical-spec.md, "Key custody".
 */
export const playerKeys = new Map(
  Object.entries(rawPlayers).map(([label, secret]) => {
    const kp = Keypair.fromSecret(secret);
    return [kp.publicKey(), { label, keypair: kp }];
  }),
);

const PLAYERS_PATH = join(SCRIPTS, 'players.json');

/**
 * Remember a player created at runtime.
 *
 * The key is written to disk as well as held in memory. A custodial key that
 * exists only in memory is a player's money lost on the next restart, which is
 * a different and much worse thing than the tier state a restart is allowed to
 * forget.
 */
export function rememberPlayer(label, keypair) {
  playerKeys.set(keypair.publicKey(), { label, keypair });

  const all = existsSync(PLAYERS_PATH)
    ? JSON.parse(readFileSync(PLAYERS_PATH, 'utf8'))
    : {};
  all[label] = keypair.secret();
  writeFileSync(PLAYERS_PATH, JSON.stringify(all, null, 2) + '\n');
}

export const config = {
  port: Number(process.env.PORT ?? 8787),

  horizonUrl: process.env.HORIZON_URL ?? 'https://horizon-testnet.stellar.org',
  sorobanRpcUrl: process.env.SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org',
  networkPassphrase: process.env.NETWORK_PASSPHRASE ?? Networks.TESTNET,

  escrowId: deployed.escrow,
  /**
   * The SAC the escrow settles in. Defaults to the anchor's asset once it is
   * deployed, because that is the one with a fiat exit; TUSDC remains the
   * fallback for running the mechanism without an anchor in the loop.
   */
  tusdcSacId: process.env.PAYOUT_SAC_ID ?? deployed.anchorSac ?? deployed.tusdcSac,

  /**
   * The campaign the demo runs against. The escrow holds many, but every
   * screen in a walkthrough should point at the same one, so it is named
   * here rather than passed around and mistyped.
   */
  demoCampaignId: Number(process.env.DEMO_CAMPAIGN_ID ?? 0),

  // Anchor. The SDF reference deployment on testnet: real SEP-10 and SEP-24,
  // test money. SRT is what it anchors and what its withdraw limits apply to.
  anchorHomeDomain: process.env.ANCHOR_HOME_DOMAIN ?? 'testanchor.stellar.org',
  anchorAssetCode: process.env.ANCHOR_ASSET_CODE ?? 'SRT',

  // Risk tiering. Config, never hardcoded: the tier rule is a business rule
  // that changes far more often than the contract does.
  clawbackWindowSeconds: Number(process.env.CLAWBACK_WINDOW_SECONDS ?? 60),
  trustTierMinAgeDays: Number(process.env.TRUST_TIER_MIN_AGE_DAYS ?? 7),
  trustTierMinTasks: Number(process.env.TRUST_TIER_MIN_TASKS ?? 5),
};

export const REWARD = new Asset('REWARD', keys.rewardIssuer.publicKey());

/**
 * The asset a player ends up holding.
 *
 * REWARD is ours and reversible; this is the one with a way out to a bank
 * account, so it is the anchor's asset whenever there is an anchor. Naming it
 * PAYOUT rather than after any one asset keeps the code honest when the
 * deployment changes, which it already has once.
 */
export const PAYOUT = process.env.PAYOUT_ASSET_ISSUER
  ? new Asset(process.env.PAYOUT_ASSET_CODE ?? 'USDC', process.env.PAYOUT_ASSET_ISSUER)
  : new Asset('TUSDC', keys.tusdcIssuer.publicKey());

/** @deprecated name kept while callers migrate to PAYOUT. */
export const TUSDC = PAYOUT;

export function assertConfigured() {
  if (!config.escrowId) throw new Error('escrow contract id missing from deployed.json');
  if (!config.tusdcSacId) throw new Error('TUSDC SAC id missing from deployed.json');
  for (const role of ['rewardIssuer', 'validator', 'sponsor', 'platform', 'publisher']) {
    if (!keys[role]) throw new Error(`keys.json is missing role: ${role}`);
  }
}
