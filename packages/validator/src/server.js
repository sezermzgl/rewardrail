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

import {
  config,
  keys,
  playerKeys,
  rememberPlayer,
  REWARD,
  PAYOUT,
  TUSDC,
  assertConfigured,
} from './config.js';
import {
  sc,
  explorer,
  readContract,
  invokeContract,
  invokeContractAsPlayer,
  submitClassic,
  submitAsPlayer,
  createSponsoredPlayer,
  assetBalance,
  payment,
  clawback,
  setTrustline,
  xdr,
  nativeToScVal,
} from './chain.js';
import { signAction } from './proof.js';
import { quote as swapQuote, swapExactIn } from './soroswap.js';
import {
  anchorToml,
  withdrawInfo,
  startWithdrawal,
  withdrawalStatus,
} from './anchor.js';
import {
  registerPlayer,
  getPlayer,
  allPlayers,
  recordTask,
  recordRewardPaid,
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

/**
 * Deliver a reward and freeze it for the clawback window, in one transaction.
 *
 * Three operations, all by the issuer. The thaw is needed because the
 * trustline is normally frozen — from the previous reward, or from a
 * clawback. Splitting these across transactions would leave a moment where
 * the reward is received and freely transferable, which is the exact gap the
 * window exists to close.
 */
function payRewardAndFreeze(player, amount) {
  return submitClassic({
    source: keys.rewardIssuer,
    ops: [
      setTrustline({ trustor: player, asset: REWARD, authorized: true }),
      payment({ destination: player, asset: REWARD, amount }),
      setTrustline({ trustor: player, asset: REWARD, authorized: false }),
    ],
  });
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
    demoCampaignId: config.demoCampaignId,
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
    const claimBefore = await readContract('reserve_of', [
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

    const claimAfter = await readContract('reserve_of', [
      sc.u64(campaignId),
      sc.address(player),
    ]);
    const amount = stroopsToUnits(BigInt(claimAfter) - BigInt(claimBefore));

    const payHash = await payRewardAndFreeze(player, amount);
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

/**
 * Deliver a reward that was recorded on chain but never paid.
 *
 * `settle` and the REWARD payment are two transactions, so the first can land
 * while the second fails. When that happens the player has a reserve in the
 * escrow and nothing in hand. This pays the difference.
 *
 * It cannot overpay: the amount is the gap between what the escrow says is
 * owed and what the player already holds, and it is skipped when that gap is
 * zero or negative.
 */
app.post('/player/reconcile', async (req, res) => {
  const { player, campaignId } = req.body ?? {};
  if (!getPlayer(player)) return fail(res, 404, 'unknown player');
  if (campaignId === undefined) return fail(res, 400, 'campaignId is required');

  const reserve = await readContract('reserve_of', [
    sc.u64(campaignId),
    sc.address(player),
  ]);
  const owed = Number(stroopsToUnits(reserve));
  const held = Number(await assetBalance(player, REWARD));
  const gap = owed - held;

  if (gap <= 0) {
    return res.json({ paid: '0', owed: owed.toFixed(7), held: held.toFixed(7), note: 'nothing outstanding' });
  }

  try {
    const amount = gap.toFixed(7);
    const hash = await payRewardAndFreeze(player, amount);
    recordRewardPaid(player);
    logEvent({ kind: 'reconcile', actor: player, amount, hash, url: explorer(hash) });
    res.json({ paid: amount, tx: { hash, url: explorer(hash) }, tier: tierOf(player) });
  } catch (err) {
    fail(res, 400, 'reconcile failed', err.message);
  }
});

/**
 * Sign in by email. No wallet, no seed phrase, no funding step.
 *
 * "Sign in" rather than "sign up" on purpose: a known email returns the
 * account it already has. A player who reopens the app expects their balance,
 * not a second empty account, and a demo that creates a duplicate on every
 * click would spend the sponsor's reserves for nothing.
 *
 * The account is created with a zero starting balance and its reserves and fee
 * are the sponsor's. This endpoint is the claim the pitch makes at 1:10, done
 * live rather than prepared by a script beforehand.
 */
app.post('/player/signup', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return fail(res, 400, 'a valid email is required');
  }

  for (const [publicKey, held] of playerKeys) {
    if (held.label === email) {
      return res.json({ player: publicKey, label: email, returning: true, tier: tierOf(publicKey) });
    }
  }

  try {
    const { player, hash } = await createSponsoredPlayer();
    rememberPlayer(email, player);
    registerPlayer(player.publicKey(), email);
    logEvent({
      kind: 'signup',
      actor: player.publicKey(),
      hash,
      url: explorer(hash),
    });

    res.json({
      player: player.publicKey(),
      label: email,
      returning: false,
      signupTx: { hash, url: explorer(hash) },
      tier: tierOf(player.publicKey()),
      note: 'account opened with zero balance; reserves and fee paid by the sponsor',
    });
  } catch (err) {
    fail(res, 400, 'signup failed', err.message);
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
  const { player, campaignId } = req.body ?? {};
  if (!getPlayer(player)) return fail(res, 404, 'unknown player');
  if (campaignId === undefined) return fail(res, 400, 'campaignId is required');

  const tier = tierOf(player);
  if (!tier.canConvert) {
    return res.status(409).json({ error: 'conversion locked', ...tier });
  }

  const custodial = playerKeys.get(player);
  if (!custodial) return fail(res, 400, 'no custodial key for this player');

  // The escrow is the source of the money, so the claim decides the amount.
  // The player's REWARD balance should match it; if it does not, something
  // upstream is wrong and paying out the larger of the two would be a bug.
  const claim = await readContract('reserve_of', [sc.u64(campaignId), sc.address(player)]);
  const claimUnits = stroopsToUnits(claim);
  const rewardBalance = await assetBalance(player, REWARD);

  if (Number(claimUnits) <= 0) return fail(res, 400, 'no claim to convert');
  if (Number(rewardBalance) < Number(claimUnits)) {
    return fail(
      res,
      409,
      'reward balance is below the claim',
      `claim ${claimUnits}, holding ${rewardBalance} — part of this reward was already clawed back or converted`,
    );
  }

  try {
    // Burn the reward first. If the withdrawal then fails the player is
    // briefly short, but the claim is still on chain and a retry completes
    // it. Withdrawing first would leave a window where the player holds both
    // the payout and a still-clawbackable reward.
    // The reward has been frozen since it was paid, so thaw it for exactly as
    // long as the burn takes. The issuer's operations and the player's sit in
    // one transaction: if the burn fails, the trustline never unfreezes.
    const burnHash = await submitClassic({
      source: keys.rewardIssuer,
      signers: [keys.rewardIssuer, custodial.keypair],
      ops: [
        setTrustline({ trustor: player, asset: REWARD, authorized: true }),
        payment({
          destination: keys.rewardIssuer.publicKey(),
          asset: REWARD,
          amount: claimUnits,
          source: player,
        }),
        setTrustline({ trustor: player, asset: REWARD, authorized: false }),
      ],
    });

    // The payout comes out of escrow, where it has been reserved since the
    // action settled. Nothing is minted.
    //
    // The platform calls this, not the player. The escrow will only send a
    // reserve to the player it belongs to, so the platform can withhold but
    // never redirect — and the platform is the only party that can confirm
    // the REWARD above was actually burned.
    const withdrawal = await invokeContract(
      'redeem_player',
      [sc.u64(campaignId), sc.address(player)],
      keys.platform,
    );

    logEvent({
      kind: 'convert',
      actor: player,
      amount: claimUnits,
      hash: withdrawal.hash,
      url: explorer(withdrawal.hash),
    });

    res.json({
      amount: claimUnits,
      burnTx: { hash: burnHash, url: explorer(burnHash) },
      withdrawTx: { hash: withdrawal.hash, url: explorer(withdrawal.hash) },
      note: 'paid out of escrow; the REWARD is burned, so this can no longer be clawed back',
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

    // No amount is passed: the contract refunds exactly the player's reserve.
    // A caller-supplied figure would let the platform inflate the budget past
    // what the escrow actually holds.
    const refund = await invokeContract(
      'refund_clawback',
      [sc.u64(campaignId), sc.address(player)],
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

/* ------------------------------------------------------------------ *
 * Console actions — contract writes the browser cannot sign
 * ------------------------------------------------------------------ *
 *
 * Every one of these needs a key: the advertiser's to open or close a
 * campaign, the publisher's to withdraw. The panels run in a browser and
 * hold none of them, so the write happens here and the panel gets the hash
 * back to show. Each logs to the shared event feed so the transaction log
 * stays a complete record of the demo rather than a partial one.
 */

/** Publisher pulls its accrued share. No minimum. */
app.post('/publisher/withdraw', async (req, res) => {
  const { campaignId, publisher = keys.publisher.publicKey() } = req.body ?? {};
  if (campaignId === undefined) return fail(res, 400, 'campaignId is required');

  // Only accounts we hold keys for can be withdrawn on behalf of; anyone
  // else has to call the contract themselves, which is as it should be.
  const signer = Object.values(keys).find((k) => k.publicKey() === publisher);
  if (!signer) return fail(res, 400, 'no key held for that publisher');

  try {
    const result = await invokeContract(
      'withdraw',
      [sc.u64(campaignId), sc.address(publisher)],
      signer,
    );
    const amount = stroopsToUnits(result.value ?? 0);
    logEvent({
      kind: 'withdraw',
      actor: publisher,
      amount,
      hash: result.hash,
      url: explorer(result.hash),
    });
    res.json({ amount, tx: { hash: result.hash, url: explorer(result.hash) } });
  } catch (err) {
    fail(res, 400, 'withdraw failed', err.message);
  }
});

/**
 * Open a campaign.
 *
 * Ratios default to the demo split rather than being required, so a panel
 * can offer one button. Shares are basis points and the contract rejects any
 * row that does not sum to 10000 — it is not enforced twice here.
 */
app.post('/campaign/open', async (req, res) => {
  const {
    budget,
    perAction = 4,
    publisher = keys.publisher.publicKey(),
    split = { player_bps: 3000, publisher_bps: 4500, platform_bps: 2500 },
  } = req.body ?? {};

  const budgetAmount = Number(budget);
  const perActionAmount = Number(perAction);
  if (!Number.isFinite(budgetAmount) || budgetAmount <= 0) {
    return fail(res, 400, 'budget must be positive');
  }
  if (!Number.isFinite(perActionAmount) || perActionAmount <= 0) {
    return fail(res, 400, 'perAction must be positive');
  }
  if (budgetAmount < perActionAmount) {
    return fail(res, 400, 'budget must cover at least one action');
  }

  const held = Number(await assetBalance(keys.advertiser.publicKey(), PAYOUT));
  if (held < budgetAmount) {
    return fail(
      res,
      409,
      'advertiser cannot cover that budget',
      `holds ${held} ${PAYOUT.getCode()} — fund it with POST /advertiser/fund`,
    );
  }

  const toStroops = (n) => BigInt(Math.round(n * 10_000_000));
  const splits = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: sc.address(publisher),
      val: nativeToScVal(
        {
          platform_bps: split.platform_bps,
          player_bps: split.player_bps,
          publisher_bps: split.publisher_bps,
        },
        {
          type: {
            platform_bps: ['symbol', 'u32'],
            player_bps: ['symbol', 'u32'],
            publisher_bps: ['symbol', 'u32'],
          },
        },
      ),
    }),
  ]);

  try {
    const result = await invokeContract(
      'open_campaign',
      [
        sc.address(keys.advertiser.publicKey()),
        sc.address(keys.platform.publicKey()),
        sc.address(config.tusdcSacId),
        sc.bytes(keys.validator.rawPublicKey()),
        sc.i128(toStroops(perActionAmount)),
        sc.i128(toStroops(budgetAmount)),
        splits,
      ],
      keys.advertiser,
    );

    const campaignId = Number(result.value);
    logEvent({
      kind: 'campaign_open',
      actor: keys.advertiser.publicKey(),
      amount: String(budgetAmount),
      hash: result.hash,
      url: explorer(result.hash),
    });
    res.json({ campaignId, tx: { hash: result.hash, url: explorer(result.hash) } });
  } catch (err) {
    fail(res, 400, 'open_campaign failed', err.message);
  }
});

/** Close a campaign and return whatever was never spent. */
app.post('/campaign/close', async (req, res) => {
  const { campaignId } = req.body ?? {};
  if (campaignId === undefined) return fail(res, 400, 'campaignId is required');

  try {
    const result = await invokeContract(
      'close_campaign',
      [sc.u64(campaignId)],
      keys.advertiser,
    );
    const refunded = stroopsToUnits(result.value ?? 0);
    logEvent({
      kind: 'campaign_close',
      actor: keys.advertiser.publicKey(),
      amount: refunded,
      hash: result.hash,
      url: explorer(result.hash),
    });
    res.json({ refunded, tx: { hash: result.hash, url: explorer(result.hash) } });
  } catch (err) {
    fail(res, 400, 'close_campaign failed', err.message);
  }
});

/* ------------------------------------------------------------------ *
 * Soroswap — funding a campaign in whatever the advertiser holds
 * ------------------------------------------------------------------ */

const SWAP_PATH = () => [config.xlmSacId, config.tusdcSacId];

/** What the router would give, before anyone commits to it. */
app.get('/advertiser/quote', async (req, res) => {
  const xlm = Number(req.query.xlm ?? 100);
  if (!Number.isFinite(xlm) || xlm <= 0) return fail(res, 400, 'xlm must be positive');

  try {
    const amountIn = BigInt(Math.round(xlm * 10_000_000));
    const quoted = await swapQuote(amountIn, SWAP_PATH());
    res.json({
      in: { asset: 'XLM', amount: stroopsToUnits(quoted.amountIn) },
      out: { asset: 'USDC', amount: stroopsToUnits(quoted.amountOut) },
      via: 'soroswap',
      router: config.soroswapRouterId,
    });
  } catch (err) {
    fail(res, 502, 'quote failed', err.message);
  }
});

/**
 * Convert the advertiser's XLM into the campaign currency.
 *
 * The escrow settles in one asset; an advertiser holds whatever it holds.
 * This is the step that stops that mismatch from being the advertiser's
 * problem — and it is a real swap against real liquidity, not an internal
 * rate we invented.
 */
app.post('/advertiser/fund', async (req, res) => {
  const { xlm } = req.body ?? {};
  const amount = Number(xlm);
  if (!Number.isFinite(amount) || amount <= 0) return fail(res, 400, 'xlm must be positive');

  try {
    const swapped = await swapExactIn({
      amountIn: BigInt(Math.round(amount * 10_000_000)),
      path: SWAP_PATH(),
      to: keys.advertiser.publicKey(),
      signer: keys.advertiser,
    });

    logEvent({
      kind: 'swap',
      actor: keys.advertiser.publicKey(),
      amount: stroopsToUnits(swapped.amountOut),
      hash: swapped.hash,
      url: explorer(swapped.hash),
    });

    res.json({
      spent: { asset: 'XLM', amount: stroopsToUnits(swapped.amountIn) },
      received: { asset: 'USDC', amount: stroopsToUnits(swapped.amountOut) },
      quoted: stroopsToUnits(swapped.quotedOut),
      minAccepted: stroopsToUnits(swapped.minOut),
      via: 'soroswap',
      tx: { hash: swapped.hash, url: explorer(swapped.hash) },
    });
  } catch (err) {
    fail(res, 502, 'swap failed', err.message);
  }
});

/* ------------------------------------------------------------------ *
 * Anchor — the exit to real money
 * ------------------------------------------------------------------ */

app.get('/anchor', async (_req, res) => {
  try {
    const toml = await anchorToml();
    const info = await withdrawInfo(config.anchorAssetCode);
    res.json({ ...toml, withdraw: info });
  } catch (err) {
    fail(res, 502, 'anchor unreachable', err.message);
  }
});

/**
 * Start a real withdrawal at the anchor.
 *
 * This is the step that turns a Stellar balance into money a person can
 * spend. The anchor authenticates the player over SEP-10, opens a SEP-24
 * withdrawal, and returns its own interactive URL for KYC and payout
 * details — which the player completes with the anchor, never with us.
 */
app.post('/player/cashout', async (req, res) => {
  const { player, amount } = req.body ?? {};
  if (!getPlayer(player)) return fail(res, 404, 'unknown player');

  const custodial = playerKeys.get(player);
  if (!custodial) return fail(res, 400, 'no custodial key for this player');

  try {
    const info = await withdrawInfo(config.anchorAssetCode);
    const requested = Number(amount ?? info.minAmount ?? 1);

    // The anchor's own bounds, checked before the player is sent anywhere
    // that would only reject them. Many anchors publish no bounds at all, and
    // an absent bound is not a bound of zero.
    const below = info.minAmount != null && requested < Number(info.minAmount);
    const above = info.maxAmount != null && requested > Number(info.maxAmount);
    if (below || above) {
      return fail(
        res,
        400,
        'amount outside the anchor limits',
        `this anchor accepts ${info.minAmount ?? 'any'}–${info.maxAmount ?? 'any'} ${info.assetCode}`,
      );
    }

    const started = await startWithdrawal({
      playerKeypair: custodial.keypair,
      assetCode: info.assetCode,
      amount: requested,
    });

    /**
     * SEP-6 expects the wallet to send the asset itself, with a memo the
     * anchor uses to match the payment to the withdrawal. We are the wallet
     * here, so we send it — fee-bumped, because the player holds no XLM.
     *
     * SEP-24 is the other shape: the anchor collects the asset through its
     * own interactive page, so there is nothing for us to send.
     */
    let deliveryTx = null;
    if (started.protocol === 'sep6') {
      if (!started.accountId) {
        throw new Error('anchor returned no account to send the withdrawal to');
      }
      const hash = await submitAsPlayer({
        player: custodial.keypair,
        sponsor: keys.sponsor,
        ops: [
          payment({
            destination: started.accountId,
            asset: PAYOUT,
            amount: String(requested),
          }),
        ],
        memo: started.memo,
        memoType: started.memoType,
      });
      deliveryTx = { hash, url: explorer(hash) };
    }

    logEvent({
      kind: 'cashout',
      actor: player,
      amount: String(requested),
      anchorTransactionId: started.id,
      hash: deliveryTx?.hash,
      url: deliveryTx?.url,
    });

    res.json({
      protocol: started.protocol,
      anchorTransactionId: started.id,
      // SEP-24 hands the player to the anchor's page; SEP-6 needs no page.
      interactiveUrl: started.url ?? null,
      deliveryTx,
      sessionToken: started.token,
      asset: info.assetCode,
      amount: requested,
      limits: { min: info.minAmount, max: info.maxAmount },
      eta: started.eta ?? null,
      note: started.extraInfo?.message ?? null,
    });
  } catch (err) {
    fail(res, 502, 'anchor withdrawal failed', err.message);
  }
});

app.get('/player/cashout/:id', async (req, res) => {
  const token = req.query.token ?? req.get('x-anchor-token');
  if (!token) return fail(res, 400, 'anchor session token is required');
  try {
    res.json(await withdrawalStatus({ id: req.params.id, token }));
  } catch (err) {
    fail(res, 502, 'status lookup failed', err.message);
  }
});

app.listen(config.port, () => {
  console.log(`validator listening on http://localhost:${config.port}`);
  console.log(`  escrow    ${config.escrowId}`);
  console.log(`  validator ${keys.validator.publicKey()}`);
  console.log(`  players   ${allPlayers().map((p) => p.label).join(', ') || 'none'}`);
});
