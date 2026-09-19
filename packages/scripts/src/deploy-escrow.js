/**
 * Build and deploy the escrow contract to testnet.
 *
 * Run: npm run deploy-escrow
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { Keypair } from '@stellar/stellar-sdk';
import { NETWORK_PASSPHRASE, log, section, assert } from './stellar.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const KEYS_PATH = join(HERE, '..', 'keys.json');
const DEPLOY_PATH = join(HERE, '..', 'deployed.json');
const CONTRACTS_DIR = join(HERE, '..', '..', 'contracts');
const WASM = join(
  CONTRACTS_DIR,
  'target',
  'wasm32v1-none',
  'release',
  'rewardrail_escrow.wasm',
);

const SOROBAN_RPC_URL =
  process.env.SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org';

function readDeployed() {
  return existsSync(DEPLOY_PATH) ? JSON.parse(readFileSync(DEPLOY_PATH, 'utf8')) : {};
}

function main() {
  console.log('RewardRail — deploy the escrow contract');

  const keys = JSON.parse(readFileSync(KEYS_PATH, 'utf8'));
  const deployer = Keypair.fromSecret(keys.platform ?? keys.sponsor);

  section('BUILD');
  execFileSync('stellar', ['contract', 'build'], {
    cwd: CONTRACTS_DIR,
    stdio: 'inherit',
  });
  assert(existsSync(WASM), 'wasm artifact exists');

  section('DEPLOY');
  const existing = readDeployed().escrow;
  if (existing && !process.env.FORCE_REDEPLOY) {
    log('already deployed', existing);
    log('set FORCE_REDEPLOY=1 to deploy a fresh instance');
    console.log(`\nESCROW_CONTRACT_ID=${existing}\n`);
    return;
  }

  const contractId = execFileSync(
    'stellar',
    [
      'contract',
      'deploy',
      '--wasm',
      WASM,
      '--source-account',
      deployer.secret(),
      '--rpc-url',
      SOROBAN_RPC_URL,
      '--network-passphrase',
      NETWORK_PASSPHRASE,
    ],
    { encoding: 'utf8' },
  ).trim();

  assert(/^C[A-Z2-7]{55}$/.test(contractId), 'escrow contract id looks well formed');
  writeFileSync(
    DEPLOY_PATH,
    JSON.stringify({ ...readDeployed(), escrow: contractId }, null, 2) + '\n',
  );
  log('deployed', contractId);
  console.log(`\nESCROW_CONTRACT_ID=${contractId}\n`);
}

try {
  main();
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exit(1);
}
