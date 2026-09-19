/**
 * Proves the clawback window is enforced, not merely declared.
 *
 * Without authorization control the window is advisory: a player can forward
 * a reward to a second account and convert it from there, and by the time
 * fraud is detected the original account is empty. This script runs that
 * attack against a frozen trustline and shows it fail.
 *
 * Run: npm run prove-auth-lock
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { Keypair, Asset, Operation } from '@stellar/stellar-sdk';

import {
  submit,
  balanceOf,
  trustlineAuthorized,
  explorer,
  log,
  section,
  assert,
} from './stellar.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(readFileSync(join(HERE, '..', f), 'utf8'));

const AMOUNT = '1.0000000';

async function main() {
  console.log('RewardRail — the clawback window is enforced by the ledger\n');

  const keys = Object.fromEntries(
    Object.entries(read('keys.json')).map(([k, v]) => [k, Keypair.fromSecret(v)]),
  );
  const players = Object.fromEntries(
    Object.entries(read('players.json')).map(([k, v]) => [k, Keypair.fromSecret(v)]),
  );

  const REWARD = new Asset('REWARD', keys.rewardIssuer.publicKey());
  const player = players.honest;

  // The attacker's destination: a second account the player controls, with an
  // authorized REWARD trustline of its own.
  section('SETUP — a second account the player controls');
  const accomplice = Keypair.random();
  const setupHash = await submit({
    source: keys.sponsor,
    signers: [keys.sponsor, accomplice, keys.rewardIssuer],
    ops: [
      Operation.beginSponsoringFutureReserves({ sponsoredId: accomplice.publicKey() }),
      Operation.createAccount({ destination: accomplice.publicKey(), startingBalance: '0' }),
      Operation.changeTrust({ asset: REWARD, source: accomplice.publicKey() }),
      Operation.endSponsoringFutureReserves({ source: accomplice.publicKey() }),
      Operation.setTrustLineFlags({
        trustor: accomplice.publicKey(),
        asset: REWARD,
        flags: { authorized: true },
        source: keys.rewardIssuer.publicKey(),
      }),
    ],
  });
  log('accomplice ready', explorer(setupHash));

  section('PAYOUT — reward is paid and frozen in the same transaction');
  const payHash = await submit({
    source: keys.rewardIssuer,
    ops: [
      Operation.setTrustLineFlags({
        trustor: player.publicKey(),
        asset: REWARD,
        flags: { authorized: true },
      }),
      Operation.payment({ destination: player.publicKey(), asset: REWARD, amount: AMOUNT }),
      Operation.setTrustLineFlags({
        trustor: player.publicKey(),
        asset: REWARD,
        flags: { authorized: false },
      }),
    ],
  });
  log('paid and frozen', explorer(payHash));

  const held = await balanceOf(player.publicKey(), REWARD);
  assert(Number(held) >= Number(AMOUNT), `player holds ${held} REWARD`);
  assert(
    (await trustlineAuthorized(player.publicKey(), REWARD)) !== true,
    'the trustline is frozen while the window is open',
  );

  section('ATTACK — move the reward beyond clawback before it is detected');
  let blocked = false;
  try {
    await submit({
      source: keys.sponsor,
      signers: [keys.sponsor, player],
      ops: [
        Operation.payment({
          destination: accomplice.publicKey(),
          asset: REWARD,
          amount: AMOUNT,
          source: player.publicKey(),
        }),
      ],
    });
  } catch (err) {
    blocked = true;
    const codes = err?.response?.data?.extras?.result_codes;
    log('transfer rejected', JSON.stringify(codes ?? err.message));
  }
  assert(blocked, 'the ledger refused the transfer');
  assert(
    (await balanceOf(accomplice.publicKey(), REWARD)) === '0.0000000',
    'the second account received nothing',
  );

  section('CLAWBACK — still reaches the reward it was meant to');
  const clawHash = await submit({
    source: keys.rewardIssuer,
    ops: [
      Operation.clawback({ from: player.publicKey(), asset: REWARD, amount: AMOUNT }),
    ],
  });
  log('clawed back', explorer(clawHash));

  section('RESULT');
  console.log('  A frozen reward cannot be moved, only held or reclaimed.');
  console.log('  The window is enforced by the ledger, not by our good intentions.\n');
}

main().catch((err) => {
  console.error('\nFAILED:', err.message);
  const extras = err?.response?.data?.extras;
  if (extras) console.error('result_codes:', JSON.stringify(extras.result_codes));
  process.exit(1);
});
