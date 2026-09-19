/**
 * Proves the single riskiest assumption in RewardRail: that an issuer can pull
 * back a reward it already paid out.
 *
 * It also proves the ordering trap documented in docs/02-technical-spec.md —
 * a trustline created BEFORE the issuer sets AUTH_CLAWBACK_ENABLED is not
 * clawback enabled, and setting the flag afterwards does not fix it.
 *
 * Run: npm run prove-clawback
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
} from './stellar.js';

const AMOUNT = '100';

async function happyPath() {
  section('PART 1 — correct ordering: flags first, then trustline');

  const issuer = await fundedKeypair('issuer');
  const holder = await fundedKeypair('holder');
  const REWARD = new Asset('REWARD', issuer.publicKey());

  // Step 1: set the flags BEFORE any trustline exists.
  const flagsHash = await submit({
    source: issuer,
    ops: [
      Operation.setOptions({
        setFlags: AuthRevocableFlag | AuthClawbackEnabledFlag,
      }),
    ],
  });
  log('set issuer flags', explorer(flagsHash));

  // Step 2: read them back. Skipping this check is how the trap bites.
  const flags = await flagsOf(issuer.publicKey());
  assert(flags.auth_revocable, 'issuer has auth_revocable');
  assert(flags.auth_clawback_enabled, 'issuer has auth_clawback_enabled');

  // Step 3: holder opens a trustline, now inheriting the clawback flag.
  const trustHash = await submit({
    source: holder,
    ops: [Operation.changeTrust({ asset: REWARD })],
  });
  log('holder trustline', explorer(trustHash));
  assert(
    (await trustlineClawbackEnabled(holder.publicKey(), REWARD)) === true,
    'trustline is clawback enabled',
  );

  // Step 4: pay the reward out.
  const payHash = await submit({
    source: issuer,
    ops: [
      Operation.payment({
        destination: holder.publicKey(),
        asset: REWARD,
        amount: AMOUNT,
      }),
    ],
  });
  log('paid reward', explorer(payHash));
  assert(
    (await balanceOf(holder.publicKey(), REWARD)) === `${AMOUNT}.0000000`,
    `holder holds ${AMOUNT} REWARD`,
  );

  // Step 5: claw it back. This is the claim the whole project rests on.
  const clawHash = await submit({
    source: issuer,
    ops: [
      Operation.clawback({
        from: holder.publicKey(),
        asset: REWARD,
        amount: AMOUNT,
      }),
    ],
  });
  log('clawed back', explorer(clawHash));
  assert(
    (await balanceOf(holder.publicKey(), REWARD)) === '0.0000000',
    'holder balance is zero after clawback',
  );

  return { payHash, clawHash };
}

async function orderingTrap() {
  section('PART 2 — wrong ordering: trustline first, flags after');

  const issuer = await fundedKeypair('issuer (late flags)');
  const holder = await fundedKeypair('holder (late flags)');
  const REWARD = new Asset('REWARD', issuer.publicKey());

  // Trustline is created while the issuer still has no clawback flag.
  await submit({
    source: holder,
    ops: [Operation.changeTrust({ asset: REWARD })],
  });
  log('holder trustline created before flags were set');

  // Now set the flags, too late for the existing trustline.
  await submit({
    source: issuer,
    ops: [
      Operation.setOptions({
        setFlags: AuthRevocableFlag | AuthClawbackEnabledFlag,
      }),
    ],
  });
  const flags = await flagsOf(issuer.publicKey());
  assert(flags.auth_clawback_enabled, 'issuer now has auth_clawback_enabled');

  assert(
    (await trustlineClawbackEnabled(holder.publicKey(), REWARD)) !== true,
    'existing trustline did NOT become clawback enabled',
  );

  await submit({
    source: issuer,
    ops: [
      Operation.payment({
        destination: holder.publicKey(),
        asset: REWARD,
        amount: AMOUNT,
      }),
    ],
  });
  log(`paid ${AMOUNT} REWARD`);

  // Clawback must fail here. If it succeeds, our documented warning is wrong.
  let failed = false;
  try {
    await submit({
      source: issuer,
      ops: [
        Operation.clawback({
          from: holder.publicKey(),
          asset: REWARD,
          amount: AMOUNT,
        }),
      ],
    });
  } catch (err) {
    failed = true;
    const codes = err?.response?.data?.extras?.result_codes;
    log('clawback rejected as expected', JSON.stringify(codes ?? err.message));
  }
  assert(failed, 'clawback on a pre-flag trustline is rejected');
  assert(
    (await balanceOf(holder.publicKey(), REWARD)) === `${AMOUNT}.0000000`,
    'holder keeps the reward — the money is unrecoverable',
  );
}

async function main() {
  console.log('RewardRail — clawback proof (Stellar testnet)');

  const { clawHash } = await happyPath();
  await orderingTrap();

  section('RESULT');
  console.log('  Clawback works when the issuer flag precedes the trustline.');
  console.log('  It is permanently unavailable when it does not.');
  console.log(`  Reference clawback tx: ${explorer(clawHash)}\n`);
}

main().catch((err) => {
  console.error('\nFAILED:', err.message);
  const extras = err?.response?.data?.extras;
  if (extras) console.error('result_codes:', JSON.stringify(extras.result_codes));
  process.exit(1);
});
