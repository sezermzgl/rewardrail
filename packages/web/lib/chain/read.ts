/**
 * Reading RewardRail's state straight from the chain.
 *
 * The panels keep no local state and refetch after every action, because a
 * balance that came from the chain is the auditability claim itself. That makes
 * read cost the thing to get right.
 *
 * Every contract read here goes through `simulateTransaction`, never a
 * submitted transaction. A simulation needs no signature, no fee and no
 * sequence number, and returns in one round trip — so a panel can refetch
 * freely. `packages/scripts/src/e2e.js` submits real transactions for its
 * reads, which is fine for a script run once and wrong for a UI that refetches
 * after every action.
 */
import {
  Account,
  Address,
  Contract,
  Horizon,
  NotFoundError,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
  BASE_FEE,
} from '@stellar/stellar-sdk';

import { config } from './config';
import type { Campaign, CampaignView, Split } from './types';

const horizon = new Horizon.Server(config.horizonUrl);
const soroban = new rpc.Server(config.sorobanRpcUrl);

/**
 * Any well-formed account works as a simulation source; it is never charged and
 * never signs. Using a fixed unfunded address keeps reads independent of whose
 * keys happen to be around.
 */
const SIMULATION_SOURCE =
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

const STROOPS = 10_000_000n;

/** Stroops to a display string, at the 7 decimals classic assets use. */
export function toDisplay(stroops: bigint, decimals = 4): string {
  const negative = stroops < 0n;
  const abs = negative ? -stroops : stroops;
  const whole = abs / STROOPS;
  const frac = (abs % STROOPS).toString().padStart(7, '0').slice(0, decimals);
  const body = decimals > 0 ? `${whole}.${frac}` : `${whole}`;
  return negative ? `-${body}` : body;
}

/** Call a read-only contract function without submitting anything. */
async function simulate<T>(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<T> {
  if (!contractId) {
    throw new Error(`no contract id configured for ${method}`);
  }

  const source = new Account(SIMULATION_SOURCE, '0');
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await soroban.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`${method} failed: ${sim.error}`);
  }
  if (!sim.result) {
    throw new Error(`${method} returned no value`);
  }
  return scValToNative(sim.result.retval) as T;
}

const addressArg = (id: string) => nativeToScVal(Address.fromString(id), { type: 'address' });
const u64Arg = (n: number | bigint) => nativeToScVal(BigInt(n), { type: 'u64' });
const bytesArg = (b: Uint8Array) => nativeToScVal(b, { type: 'bytes' });

/* ------------------------------------------------------------------ *
 * Escrow
 * ------------------------------------------------------------------ */

export function getCampaign(campaignId: number): Promise<Campaign> {
  return simulate<Campaign>(config.escrowId, 'get_campaign', [u64Arg(campaignId)]);
}

/**
 * A publisher's or the platform's accrued, not yet withdrawn claim.
 *
 * Returns 0 for a player, and that is not a bug. A claim is withdrawable by
 * whoever owns it; a player's payout is owed against a REWARD token they are
 * still holding, so letting them call `withdraw` would hand over the escrowed
 * value while they kept the reward — the same value twice. Player balances live
 * in `reserveOf`.
 */
export function claimOf(campaignId: number, who: string): Promise<bigint> {
  return simulate<bigint>(config.escrowId, 'claim_of', [
    u64Arg(campaignId),
    addressArg(who),
  ]);
}

/** A player's entitlement, held against the REWARD they still hold. */
export function reserveOf(campaignId: number, player: string): Promise<bigint> {
  return simulate<bigint>(config.escrowId, 'reserve_of', [
    u64Arg(campaignId),
    addressArg(player),
  ]);
}

/**
 * What a given account is owed by this campaign, whichever side it sits on.
 *
 * The player panel and the publisher panel ask the same question of different
 * actors, and only one of the two reads returns anything, so asking both and
 * taking the non-zero one keeps the call site from needing to know the role.
 */
export async function owedTo(campaignId: number, who: string): Promise<bigint> {
  const [claim, reserve] = await Promise.all([
    claimOf(campaignId, who),
    reserveOf(campaignId, who),
  ]);
  return claim > 0n ? claim : reserve;
}

export function isSettled(actionId: Uint8Array): Promise<boolean> {
  return simulate<boolean>(config.escrowId, 'is_settled', [bytesArg(actionId)]);
}

/* ------------------------------------------------------------------ *
 * Balances
 * ------------------------------------------------------------------ */

/**
 * A contract's balance of a classic asset, read through that asset's SAC.
 *
 * The escrow is a contract, so its TUSDC does not appear in Horizon at all —
 * only the SAC knows about it. This is what the advertiser panel shows as
 * "locked in escrow".
 */
export function contractAssetBalance(
  sacId: string,
  holder: string,
): Promise<bigint> {
  return simulate<bigint>(sacId, 'balance', [addressArg(holder)]);
}

/** A classic account's balance of an issued asset, as a display string. */
export async function accountAssetBalance(
  publicKey: string,
  code: string,
  issuer: string,
): Promise<string> {
  try {
    const account = await horizon.loadAccount(publicKey);
    const line = account.balances.find(
      (b) =>
        'asset_code' in b && b.asset_code === code && b.asset_issuer === issuer,
    );
    return line ? line.balance : '0';
  } catch (err) {
    // No account yet is a normal state for a player before signup, not a fault.
    if (err instanceof NotFoundError) return '0';
    throw err;
  }
}

/* ------------------------------------------------------------------ *
 * Composed reads
 * ------------------------------------------------------------------ */

/**
 * Everything the advertiser panel can read about a campaign, in one call.
 *
 * Note what is missing. `open_campaign` takes a budget, transfers it and keeps
 * only `remaining`, so "spent so far" is not recoverable. And one contract
 * carries every campaign, so its token balance is a total, not this campaign's
 * escrow. Both gaps are recorded as F4 in docs/03-contract-interface.md; a
 * `budget` field on `Campaign` would close the first one.
 *
 * What is exact and per-campaign: `remaining`, `per_action`, the split table,
 * `open`, and any single party's claim via `claimOf`.
 */
export async function getCampaignView(campaignId: number): Promise<CampaignView> {
  const campaign = await getCampaign(campaignId);
  const escrowStroops = await contractAssetBalance(config.tusdcSacId, config.escrowId);

  const splits: CampaignView['splits'] = Object.entries(campaign.splits).map(
    ([publisher, split]) => ({ publisher, ...(split as Split) }),
  );

  return {
    id: campaignId,
    advertiser: campaign.advertiser,
    platform: campaign.platform,
    open: campaign.open,
    perAction: toDisplay(campaign.per_action),
    remaining: toDisplay(campaign.remaining),
    escrowTotalBalance: toDisplay(escrowStroops),
    splits,
  };
}
