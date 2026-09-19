/**
 * The validator service.
 *
 * It signs action proofs and decides risk tiers. It never holds campaign
 * funds: the escrow only pays what the contract itself computes, so a stolen
 * validator key can misdirect a payout but cannot change its size or drain a
 * budget.
 *
 * Run: npm start
 */
import express from 'express';

import { config, keys, playerKeys, REWARD, TUSDC, assertConfigured } from './config.js';
import {
  sc,
  explorer,
  readContract,
  invokeContract,
  submitClassic,
  submitAsPlayer,
  assetBalance,
  payment,
  clawback,
} from './chain.js';
import { signAction } from './proof.js';
import {
  registerPlayer,
  getPlayer,
  allPlayers,
  recordTask,
  flagPlayer,
  tierOf,
  logEvent,
  allEvents,
} from './store.js';

assertConfigured();

const app = express();
app.use(express.json());

/** Seed the store from the players the signup script created. */
for (const [publicKey, { label }] of playerKeys) {
  registerPlayer(publicKey, label);
}

const stroopsToUnits = (stroops) => (Number(stroops) / 10_000_000).toFixed(7);

function fail(res, status, message, detail) {
  return res.status(status).json({ error: message, detail: detail ?? undefined });
}

/* ------------------------------------------------------------------ *
 * Health and state
 * ------------------------------------------------------------------ */

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    escrow: config.escrowId,
    tusdcSac: config.tusdcSacId,
    validator: keys.validator.publicKey(),
    tiers: {
      clawbackWindowSeconds: config.clawbackWindowSeconds,
      minAgeDays: config.trustTierMinAgeDays,
      minTasks: config.trustTierMinTasks,
    },
  });
});

app.get('/events', (_req, res) => res.json(allEvents()));

app.get('/players', async (_req, res) => {
  const rows = await Promise.all(
    allPlayers().map(async (p) => ({
      ...p,
      ...tierOf(p.publicKey),
      rewardBalance: await assetBalance(p.publicKey, REWARD),
      tusdcBalance: await assetBalance(p.publicKey, TUSDC),
    })),
  );
  res.json(rows);
});

app.get('/campaign/:id', async (req, res) => {
  try {
    const campaign = await readContract('get_campaign', [sc.u64(req.params.id)]);
    res.json({
      ...campaign,
      remaining: campaign.remaining?.toString(),
      per_action: campaign.per_action?.toString(),
    });
  } catch (err) {
    fail(res, 404, 'campaign not found', err.message);
  }
});

/* ------------------------------------------------------------------ *
 * The core flow
 * ------------------------------------------------------------------ */

/**
 * A completed task becomes money.
 *
 * Two transactions, deliberately. `settle` records the entitlement on chain,
 * then a classic payment delivers REWARD. The contract cannot mint REWARD
 * itself because the asset's SAC admin is the classic issuer account; the
 * reasoning is in docs/02-technical-spec.md.
 *
 * If the second transaction fails the first still stands, and `action_id` is
 * already spent, so a retry cannot double-pay. The player's entitlement
 * remains visible as a claim in the meantime.
 */
app.post('/action/complete', async (req, res) => {
  const { campaignId, player, publisher = keys.publisher.publicKey() } = req.body ?? {};
  if (campaignId === undefined || !player) {
    return fail(res, 400, 'campaignId and player are required');
  }
  if (!getPlayer(player)) return fail(res, 404, 'unknown player');

  try {
    const { actionId, signature } = signAction({ campaignId, player, publisher });

    // Claims accumulate across actions, so the payout is the delta this
    // settle produced. Reading the total would pay a returning player their
    // entire history again on every task.
    const claimBefore = await readContract('claim_of', [
      sc.u64(campaignId),
      sc.address(player),
    ]);

    const settled = await invokeContract(
      'settle',
      [
        sc.u64(campaignId),
        sc.address(player),
        sc.address(publisher),
        sc.bytes(actionId),
        sc.bytes(signature),
      ],
      keys.sponsor,
    );
    logEvent({ kind: 'settle', actor: player, hash: settled.hash, url: explorer(settled.hash) });

    const claimAfter = await readContract('claim_of', [
      sc.u64(campaignId),
      sc.address(player),
    ]);
    const amount = stroopsToUnits(BigInt(claimAfter) - BigInt(claimBefore));

    const payHash = await submitClassic({
      source: keys.rewardIssuer,
      ops: [payment({ destination: player, asset: REWARD, amount })],
    });
    logEvent({ kind: 'reward', actor: player, amount, hash: payHash, url: explorer(payHash) });

    recordTask(player);

    res.json({
      actionId: actionId.toString('hex'),
      amount,
      settleTx: { hash: settled.hash, url: explorer(settled.hash) },
      rewardTx: { hash: payHash, url: explorer(payHash) },
      tier: tierOf(player),
    });
  } catch (err) {
    fail(res, 400, 'settle failed', err.message);
  }
});

app.get('/player/tier', (req, res) => {
  const { player } = req.query;
  if (!getPlayer(player)) return fail(res, 404, 'unknown player');
  res.json({ player, ...tierOf(player) });
});

/**
 * Convert REWARD to TUSDC — the moment the reward stops being reversible.
 *
 * The tier gate is enforced here rather than on chain. That is a real
 * limitation and it is stated in the spec: the platform could in principle
 * stall a conversion. What the chain does enforce is the split and the
 * replay guard, which is where the advertiser's money is at stake.
 */
app.post('/player/convert', async (req, res) => {
  const { player, amount } = req.body ?? {};
  const record = getPlayer(player);
  if (!record) return fail(res, 404, 'unknown player');

  const tier = tierOf(player);
  if (!tier.canConvert) {
    return res.status(409).json({
      error: 'conversion locked',
      ...tier,
    });
  }

  const custodial = playerKeys.get(player);
  if (!custodial) return fail(res, 400, 'no custodial key for this player');

  const balance = await assetBalance(player, REWARD);
  const sendAmount = amount ?? balance;
  if (Number(sendAmount) <= 0) return fail(res, 400, 'nothing to convert');

  try {
    // REWARD goes back to its issuer and TUSDC comes out, one for one. In
    // production this is a path payment across the DEX; here the platform
    // backs the reward directly, which keeps the demo free of liquidity setup.
    const burnHash = await submitAsPlayer({
      player: custodial.keypair,
      sponsor: keys.sponsor,
      ops: [
        payment({
          destination: keys.rewardIssuer.publicKey(),
          asset: REWARD,
          amount: sendAmount,
        }),
      ],
    });

    const payoutHash = await submitClassic({
      source: keys.tusdcIssuer,
      ops: [payment({ destination: player, asset: TUSDC, amount: sendAmount })],
    });

    logEvent({
      kind: 'convert',
      actor: player,
      amount: sendAmount,
      hash: payoutHash,
      url: explorer(payoutHash),
    });

    res.json({
      amount: sendAmount,
      burnTx: { hash: burnHash, url: explorer(burnHash) },
      payoutTx: { hash: payoutHash, url: explorer(payoutHash) },
      note: 'REWARD is gone, so this payout can no longer be clawed back',
    });
  } catch (err) {
    fail(res, 400, 'conversion failed', err.message);
  }
});

/**
 * Flag a player and reverse what they were paid.
 *
 * Clawback only reaches REWARD that is still REWARD. A player who already
 * converted keeps their money, which is the point of the window rather than
 * a hole in it.
 */
app.post('/fraud/flag', async (req, res) => {
  const { player, campaignId } = req.body ?? {};
  if (!getPlayer(player)) return fail(res, 404, 'unknown player');
  if (campaignId === undefined) return fail(res, 400, 'campaignId is required');

  const balance = await assetBalance(player, REWARD);
  flagPlayer(player);

  if (Number(balance) <= 0) {
    logEvent({ kind: 'flag', actor: player, note: 'nothing left to claw back' });
    return res.json({
      player,
      clawedBack: '0',
      note: 'player already converted — the payout is theirs, the window had closed',
      tier: tierOf(player),
    });
  }

  try {
    const clawHash = await submitClassic({
      source: keys.rewardIssuer,
      ops: [clawback({ from: player, asset: REWARD, amount: balance })],
    });
    logEvent({
      kind: 'clawback',
      actor: player,
      amount: balance,
      hash: clawHash,
      url: explorer(clawHash),
    });

    const stroops = BigInt(Math.round(Number(balance) * 10_000_000));
    const refund = await invokeContract(
      'refund_clawback',
      [sc.u64(campaignId), sc.address(player), sc.i128(stroops)],
      keys.platform,
    );
    logEvent({
      kind: 'refund',
      actor: player,
      amount: balance,
      hash: refund.hash,
      url: explorer(refund.hash),
    });

    res.json({
      player,
      clawedBack: balance,
      clawbackTx: { hash: clawHash, url: explorer(clawHash) },
      refundTx: { hash: refund.hash, url: explorer(refund.hash) },
      tier: tierOf(player),
    });
  } catch (err) {
    fail(res, 400, 'clawback failed', err.message);
  }
});

app.listen(config.port, () => {
  console.log(`validator listening on http://localhost:${config.port}`);
  console.log(`  escrow    ${config.escrowId}`);
  console.log(`  validator ${keys.validator.publicKey()}`);
  console.log(`  players   ${allPlayers().map((p) => p.label).join(', ') || 'none'}`);
});
