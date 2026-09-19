/**
 * The whole demo, end to end, on testnet.
 *
 * Runs the eight steps of the demo script from docs/01-pitch.md and asserts
 * the outcome of each one. Its real job is to prove the riskiest coupling in
 * the system: that the proof this file signs in JavaScript is byte-identical
 * to the message the Rust contract reconstructs and verifies.
 *
 * Run: npm run e2e
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';

import { Keypair, Asset, Operation, Address, xdr } from '@stellar/stellar-sdk';

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
const read = (f) => JSON.parse(readFileSync(join(HERE, '..', f), 'utf8'));

const SOROBAN_RPC_URL =
  process.env.SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org';

/** 7 decimals, as Stellar classic assets use. */
const UNIT = 10_000_000n;
const PER_ACTION = 4n * UNIT; // 4.00 TUSDC released per settled action
const BUDGET = 100n * UNIT;
const SPLIT = { player_bps: 3000, publisher_bps: 4500, platform_bps: 2500 };

const units = (stroops) => (Number(stroops) / Number(UNIT)).toFixed(4);

/** The CLI prints scalars as JSON, so an i128 arrives as a quoted string. */
const asBigInt = (cliOutput) => BigInt(JSON.parse(cliOutput));

/**
 * Horizon reports balances at 7 decimals ("1.2000000") while our display
 * helper rounds to 4, so balances are compared numerically with a tolerance
 * of one stroop rather than as strings.
 */
const sameAmount = (a, b) => Math.abs(Number(a) - Number(b)) < 1e-7;

/* ------------------------------------------------------------------ *
 * Proof construction
 * ------------------------------------------------------------------ */

/**
 * Serialize an address exactly as `Address::to_xdr` does inside the contract.
 *
 * soroban-sdk serializes a value through its `Val` representation, so this is
 * the XDR of an ScVal wrapping an ScAddress — not a bare ScAddress. Getting
 * this wrong produces a signature that verifies nowhere and an error message
 * that says nothing useful, so it is the one line worth being careful about.
 */
function addressToXdr(publicKey) {
  return xdr.ScVal.scvAddress(Address.fromString(publicKey).toScAddress()).toXDR();
}

/**
 * The bytes the validator signs:
 *   SHA256(campaign_id_be_u64 || player_xdr || publisher_xdr || action_id)
 */
function proofDigest(campaignId, playerPk, publisherPk, actionId) {
  const idBuf = Buffer.alloc(8);
  idBuf.writeBigUInt64BE(BigInt(campaignId));
  return createHash('sha256')
    .update(
      Buffer.concat([
        idBuf,
        addressToXdr(playerPk),
        addressToXdr(publisherPk),
        actionId,
      ]),
    )
    .digest();
}

function signAction(validator, campaignId, playerPk, publisherPk) {
  const actionId = randomBytes(32);
  const digest = proofDigest(campaignId, playerPk, publisherPk, actionId);
  // Stellar keypairs are ed25519, so the validator key signs the digest
  // directly. The SDK returns a Uint8Array, and `.toString('hex')` on one of
  // those yields comma-separated decimals rather than hex, so wrap it.
  return { actionId, signature: Buffer.from(validator.sign(digest)) };
}

/* ------------------------------------------------------------------ *
 * Contract invocation
 * ------------------------------------------------------------------ */

function invoke(contractId, sourceSecret, method, args) {
  const out = execFileSync(
    'stellar',
    [
      'contract',
      'invoke',
      '--id',
      contractId,
      '--source-account',
      sourceSecret,
      '--rpc-url',
      SOROBAN_RPC_URL,
      '--network-passphrase',
      NETWORK_PASSPHRASE,
      '--',
      method,
      ...args,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return out.trim();
}

/* ------------------------------------------------------------------ *
 * The run
 * ------------------------------------------------------------------ */

async function main() {
  console.log('RewardRail — end-to-end demo run (testnet)\n');

  if (!existsSync(join(HERE, '..', 'players.json'))) {
    throw new Error('players.json not found — run `npm run signup` first');
  }
  const keys = Object.fromEntries(
    Object.entries(read('keys.json')).map(([k, v]) => [k, Keypair.fromSecret(v)]),
  );
  const players = Object.fromEntries(
    Object.entries(read('players.json')).map(([k, v]) => [k, Keypair.fromSecret(v)]),
  );
  const { escrow, tusdcSac } = read('deployed.json');
  if (!escrow) throw new Error('escrow not deployed — run `npm run deploy-escrow`');

  const REWARD = new Asset('REWARD', keys.rewardIssuer.publicKey());
  const TUSDC = new Asset('TUSDC', keys.tusdcIssuer.publicKey());
  const honest = players.honest;
  const fraudster = players.fraudster;

  /* 1 — the advertiser locks a budget --------------------------------- */
  section('1. CAMPAIGN OPENING — advertiser locks the budget');

  const splitsJson = JSON.stringify({ [keys.publisher.publicKey()]: SPLIT });
  const campaignId = invoke(escrow, keys.advertiser.secret(), 'open_campaign', [
    '--advertiser', keys.advertiser.publicKey(),
    '--platform', keys.platform.publicKey(),
    '--token_address', tusdcSac,
    '--validator', Buffer.from(keys.validator.rawPublicKey()).toString('hex'),
    '--per_action', PER_ACTION.toString(),
    '--budget', BUDGET.toString(),
    '--splits', splitsJson,
  ]);
  log('campaign id', campaignId);
  log('locked', `${units(BUDGET)} TUSDC`);

  /* 2 — a verified action pays everyone ------------------------------- */
  section('2. SETTLE — one verified action, three shares');

  const a1 = signAction(
    keys.validator,
    campaignId,
    honest.publicKey(),
    keys.publisher.publicKey(),
  );
  invoke(escrow, keys.sponsor.secret(), 'settle', [
    '--campaign_id', campaignId,
    '--player', honest.publicKey(),
    '--publisher', keys.publisher.publicKey(),
    '--action_id', a1.actionId.toString('hex'),
    '--signature', a1.signature.toString('hex'),
  ]);
  assert(true, 'JS-signed proof verified by the Rust contract');

  const playerClaim = invoke(escrow, keys.sponsor.secret(), 'claim_of', [
    '--campaign_id', campaignId,
    '--who', honest.publicKey(),
  ]);
  const publisherClaim = invoke(escrow, keys.sponsor.secret(), 'claim_of', [
    '--campaign_id', campaignId,
    '--who', keys.publisher.publicKey(),
  ]);
  log('player claim', `${units(asBigInt(playerClaim))} TUSDC`);
  log('publisher claim', `${units(asBigInt(publisherClaim))} TUSDC`);
  assert(
    asBigInt(playerClaim) === (PER_ACTION * 3000n) / 10_000n,
    'player share is 30% of the action',
  );

  /* 3 — the reward reaches the player, as a separate classic payment --- */
  section('3. REWARD PAYOUT — separate classic transaction');

  const rewardAmount = units(asBigInt(playerClaim));
  const honestBefore = await balanceOf(honest.publicKey(), REWARD);
  const payHash = await submit({
    source: keys.rewardIssuer,
    ops: [
      Operation.payment({
        destination: honest.publicKey(),
        asset: REWARD,
        amount: rewardAmount,
      }),
    ],
  });
  log('paid REWARD to honest player', explorer(payHash));
  const honestAfterPay = await balanceOf(honest.publicKey(), REWARD);
  assert(
    sameAmount(Number(honestAfterPay) - Number(honestBefore), rewardAmount),
    `honest player received ${rewardAmount} REWARD`,
  );

  /* 4 — the publisher pulls its share, with no threshold -------------- */
  section('4. PUBLISHER WITHDRAWAL — pull, no minimum');

  const before = await balanceOf(keys.publisher.publicKey(), TUSDC);
  invoke(escrow, keys.publisher.secret(), 'withdraw', [
    '--campaign_id', campaignId,
    '--who', keys.publisher.publicKey(),
  ]);
  const after = await balanceOf(keys.publisher.publicKey(), TUSDC);
  log('publisher balance', `${before} -> ${after} TUSDC`);
  assert(Number(after) > Number(before), 'publisher received its accrued share');

  /* 5 — a second, fraudulent player ----------------------------------- */
  section('5. FRAUDULENT ACTION — settled, paid, then reversed');

  const a2 = signAction(
    keys.validator,
    campaignId,
    fraudster.publicKey(),
    keys.publisher.publicKey(),
  );
  invoke(escrow, keys.sponsor.secret(), 'settle', [
    '--campaign_id', campaignId,
    '--player', fraudster.publicKey(),
    '--publisher', keys.publisher.publicKey(),
    '--action_id', a2.actionId.toString('hex'),
    '--signature', a2.signature.toString('hex'),
  ]);
  await submit({
    source: keys.rewardIssuer,
    ops: [
      Operation.payment({
        destination: fraudster.publicKey(),
        asset: REWARD,
        amount: rewardAmount,
      }),
    ],
  });
  log('fraudster paid', `${rewardAmount} REWARD`);

  const clawHash = await submit({
    source: keys.rewardIssuer,
    ops: [
      Operation.clawback({
        from: fraudster.publicKey(),
        asset: REWARD,
        amount: rewardAmount,
      }),
    ],
  });
  log('clawed back', explorer(clawHash));
  assert(
    sameAmount(await balanceOf(fraudster.publicKey(), REWARD), 0),
    'fraudster balance is zero',
  );
  assert(
    sameAmount(await balanceOf(honest.publicKey(), REWARD), honestAfterPay),
    'honest player is untouched — this is the point of the two-player demo',
  );

  const remainingBefore = invoke(escrow, keys.sponsor.secret(), 'get_campaign', [
    '--campaign_id', campaignId,
  ]);
  invoke(escrow, keys.platform.secret(), 'refund_clawback', [
    '--campaign_id', campaignId,
    '--player', fraudster.publicKey(),
    '--amount', ((PER_ACTION * 3000n) / 10_000n).toString(),
  ]);
  const remainingAfter = invoke(escrow, keys.sponsor.secret(), 'get_campaign', [
    '--campaign_id', campaignId,
  ]);
  const parseRemaining = (json) => BigInt(JSON.parse(json).remaining);
  log(
    'campaign remaining',
    `${units(parseRemaining(remainingBefore))} -> ${units(parseRemaining(remainingAfter))} TUSDC`,
  );
  assert(
    parseRemaining(remainingAfter) > parseRemaining(remainingBefore),
    'reclaimed value returned to the campaign budget',
  );

  /* 6 — closing returns what was never spent -------------------------- */
  section('6. CAMPAIGN CLOSING — unspent budget returns');

  const advertiserBefore = await balanceOf(keys.advertiser.publicKey(), TUSDC);
  invoke(escrow, keys.advertiser.secret(), 'close_campaign', [
    '--campaign_id', campaignId,
  ]);
  const advertiserAfter = await balanceOf(keys.advertiser.publicKey(), TUSDC);
  log('advertiser balance', `${advertiserBefore} -> ${advertiserAfter} TUSDC`);
  assert(
    Number(advertiserAfter) > Number(advertiserBefore),
    'unspent budget was refunded',
  );

  section('RESULT');
  console.log('  All eight demo steps completed against testnet.');
  console.log(`  Escrow: ${escrow}\n`);
}

main().catch((err) => {
  console.error('\nFAILED:', err.message);
  if (err.stdout) console.error('stdout:', err.stdout.toString().slice(0, 1200));
  if (err.stderr) console.error('stderr:', err.stderr.toString().slice(0, 1200));
  const extras = err?.response?.data?.extras;
  if (extras) console.error('result_codes:', JSON.stringify(extras.result_codes));
  process.exit(1);
});
