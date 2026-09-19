/**
 * Settles decision D1 in docs/03-contract-interface.md: if REWARD gets a
 * Stellar Asset Contract and that contract's admin is moved away from the
 * classic issuer, does the issuer still hold clawback authority?
 *
 * Option A of D1 — the escrow contract mints REWARD itself — is only viable if
 * the answer is yes. The whole project rests on clawback, so this is measured
 * rather than assumed.
 *
 * This is an experiment, not a test. Only the baseline is asserted; the
 * question itself is observed and reported.
 *
 * The admin is moved to an ACCOUNT rather than a contract, because no escrow
 * contract exists yet. That answers the ledger-level question — whether classic
 * issuer authority survives an admin change — but not whether a contract admin
 * can mint. Read the result with that boundary in mind.
 *
 * Run: npm run prove-sac-admin
 */
import {
  Asset,
  Operation,
  AuthRevocableFlag,
  AuthClawbackEnabledFlag,
} from '@stellar/stellar-sdk';

import {
  fundedKeypair,
  submit,
  balanceOf,
  flagsOf,
  trustlineClawbackEnabled,
  explorer,
  log,
  section,
  assert,
  NETWORK_PASSPHRASE,
} from './stellar.js';

import { deploySac, invoke, addr, i128 } from './soroban.js';

const PAID = '100';
const STEP = '10';

/** Run something that may legitimately fail, and report which it was. */
async function attempt(label, fn) {
  try {
    const result = await fn();
    log(`${label}:`, 'SUCCEEDED');
    return { ok: true, result };
  } catch (err) {
    const codes = err?.response?.data?.extras?.result_codes;
    log(`${label}:`, `FAILED — ${JSON.stringify(codes ?? err.message)}`);
    return { ok: false, error: err };
  }
}

async function setup() {
  section('SETUP — issuer with clawback, holder paid 100 REWARD');

  const issuer = await fundedKeypair('issuer');
  const holder = await fundedKeypair('holder');
  const newAdmin = await fundedKeypair('new admin');
  const REWARD = new Asset('REWARD', issuer.publicKey());

  await submit({
    source: issuer,
    ops: [
      Operation.setOptions({
        setFlags: AuthRevocableFlag | AuthClawbackEnabledFlag,
      }),
    ],
  });

  const flags = await flagsOf(issuer.publicKey());
  assert(flags.auth_clawback_enabled, 'issuer has auth_clawback_enabled');

  await submit({ source: holder, ops: [Operation.changeTrust({ asset: REWARD })] });
  assert(
    (await trustlineClawbackEnabled(holder.publicKey(), REWARD)) === true,
    'holder trustline is clawback enabled',
  );

  await submit({
    source: issuer,
    ops: [
      Operation.payment({ destination: holder.publicKey(), asset: REWARD, amount: PAID }),
    ],
  });
  assert((await balanceOf(holder.publicKey(), REWARD)) === `${PAID}.0000000`, `holder holds ${PAID}`);

  return { issuer, holder, newAdmin, REWARD };
}

async function baseline({ issuer, holder, REWARD }) {
  section('PART 1 — SAC deployed, admin untouched');

  const { hash, value } = await deploySac(REWARD, issuer);
  log('REWARD SAC deployed', value ?? '');
  log('deploy tx', explorer(hash));

  const sacId = REWARD.contractId(NETWORK_PASSPHRASE);
  log('deterministic SAC id', sacId);

  const clawed = await attempt('classic CLAWBACK with SAC present', () =>
    submit({
      source: issuer,
      ops: [
        Operation.clawback({ from: holder.publicKey(), asset: REWARD, amount: STEP }),
      ],
    }),
  );
  assert(clawed.ok, 'deploying a SAC alone does not disturb classic clawback');
  log('holder balance', await balanceOf(holder.publicKey(), REWARD));

  return sacId;
}

async function afterAdminMove({ issuer, holder, newAdmin, REWARD }, sacId) {
  section('PART 2 — admin moved off the issuer');

  const before = await invoke({ contractId: sacId, fn: 'admin', source: issuer });
  log('admin before', String(before.value));

  const moved = await attempt('set_admin to another address', () =>
    invoke({
      contractId: sacId,
      fn: 'set_admin',
      args: [addr(newAdmin.publicKey())],
      source: issuer,
    }),
  );

  if (!moved.ok) {
    section('FINDING');
    console.log('  set_admin itself was rejected on a wrapped classic asset.');
    console.log('  D1 option A is not available. Choose option B.\n');
    return;
  }

  const after = await invoke({ contractId: sacId, fn: 'admin', source: newAdmin });
  log('admin after', String(after.value));

  // The question this script exists to answer.
  const claw = await attempt('classic CLAWBACK by the issuer, admin moved away', () =>
    submit({
      source: issuer,
      ops: [
        Operation.clawback({ from: holder.publicKey(), asset: REWARD, amount: STEP }),
      ],
    }),
  );

  const mint = await attempt('classic PAYMENT (issuance) by the issuer', () =>
    submit({
      source: issuer,
      ops: [
        Operation.payment({ destination: holder.publicKey(), asset: REWARD, amount: STEP }),
      ],
    }),
  );

  const sacMint = await attempt('SAC mint by the new admin', () =>
    invoke({
      contractId: sacId,
      fn: 'mint',
      args: [addr(holder.publicKey()), i128(STEP)],
      source: newAdmin,
    }),
  );

  const sacClaw = await attempt('SAC clawback by the new admin', () =>
    invoke({
      contractId: sacId,
      fn: 'clawback',
      args: [addr(holder.publicKey()), i128(STEP)],
      source: newAdmin,
    }),
  );

  log('final holder balance', await balanceOf(holder.publicKey(), REWARD));

  section('FINDING');
  console.log(`  classic clawback after admin move : ${claw.ok ? 'WORKS' : 'BROKEN'}`);
  console.log(`  classic issuance after admin move : ${mint.ok ? 'WORKS' : 'BROKEN'}`);
  console.log(`  new admin can mint via SAC        : ${sacMint.ok ? 'YES' : 'NO'}`);
  console.log(`  new admin can claw back via SAC   : ${sacClaw.ok ? 'YES' : 'NO'}`);
  console.log();
  if (claw.ok && sacMint.ok) {
    console.log('  D1 option A is viable: an escrow contract could hold mint');
    console.log('  authority while the classic issuer keeps clawback.');
    console.log('  Caveat: admin here is an account, not a contract.');
  } else if (!claw.ok) {
    console.log('  D1 option A is NOT viable: moving the admin costs the issuer');
    console.log('  its clawback authority, which is the project premise. Use B.');
  } else {
    console.log('  Mixed result — read the lines above before deciding.');
  }
  console.log();
}

async function main() {
  console.log('RewardRail — does SAC admin transfer cost the issuer its clawback? (testnet)');

  const world = await setup();
  const sacId = await baseline(world);
  await afterAdminMove(world, sacId);
}

main().catch((err) => {
  console.error('\nFAILED:', err.message);
  const extras = err?.response?.data?.extras;
  if (extras) console.error('result_codes:', JSON.stringify(extras.result_codes));
  process.exit(1);
});
