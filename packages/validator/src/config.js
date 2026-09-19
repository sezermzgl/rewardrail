/**
 * Configuration and key loading.
 *
 * Keys are read from the files the setup scripts produce. This is a hackathon
 * shortcut and an explicit one: in production the issuer and validator secrets
 * belong in a KMS, not on disk next to the service. The presentation says so.
 */
import { readFileSync, existsSync } from 'node:fs';
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

export const config = {
  port: Number(process.env.PORT ?? 8787),

  horizonUrl: process.env.HORIZON_URL ?? 'https://horizon-testnet.stellar.org',
  sorobanRpcUrl: process.env.SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org',
  networkPassphrase: process.env.NETWORK_PASSPHRASE ?? Networks.TESTNET,

  escrowId: deployed.escrow,
  tusdcSacId: deployed.tusdcSac,

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
export const TUSDC = new Asset('TUSDC', keys.tusdcIssuer.publicKey());

export function assertConfigured() {
  if (!config.escrowId) throw new Error('escrow contract id missing from deployed.json');
  if (!config.tusdcSacId) throw new Error('TUSDC SAC id missing from deployed.json');
  for (const role of ['rewardIssuer', 'validator', 'sponsor', 'platform', 'publisher']) {
    if (!keys[role]) throw new Error(`keys.json is missing role: ${role}`);
  }
}
