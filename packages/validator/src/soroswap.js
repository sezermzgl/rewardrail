/**
 * Soroswap — the swap that lets an advertiser fund a campaign in any asset.
 *
 * An escrow settles in one currency, because share ratios and reserves have
 * to be denominated in something. An advertiser holds whatever it holds. Left
 * alone, that mismatch pushes the problem onto the advertiser: acquire the
 * exact asset first, then come back.
 *
 * Routing through Soroswap removes the step. The advertiser funds in XLM and
 * the escrow receives the payout currency, at a price the router quotes and
 * the advertiser approves before anything moves.
 *
 * We call the router contract directly rather than the aggregator API: the
 * API is mainnet-only and key-gated, while the contracts are on testnet and
 * need neither.
 */
import { readAnyContract, invokeAnyContract, sc } from './chain.js';
import { config } from './config.js';

/**
 * Deadlines are absolute ledger time. Too short and a busy network voids a
 * legitimate swap; too long and a stale quote can execute at a price nobody
 * agreed to. Ten minutes is the usual compromise.
 */
const DEADLINE_SECONDS = 600;

/** Basis points of slippage tolerated between the quote and execution. */
const SLIPPAGE_BPS = 100n; // 1%

/**
 * What the router would give for `amountIn` along `path`.
 *
 * Read from the router rather than computed here. A price we derive from
 * reserves is a guess about the protocol's own maths; a price it returns is
 * the one it will honour.
 */
export async function quote(amountIn, path) {
  const amounts = await readAnyContract(
    config.soroswapRouterId,
    'router_get_amounts_out',
    [sc.i128(amountIn), sc.addressVec(path)],
  );
  return {
    amountIn: BigInt(amounts[0]),
    amountOut: BigInt(amounts[amounts.length - 1]),
    path,
  };
}

/**
 * Swap along `path`, refusing anything worse than the quote minus slippage.
 *
 * `amountOutMin` is the whole protection. Without it the swap executes at
 * whatever the pool offers by the time it lands, which on a thin pool is
 * whatever an observer decides to make it.
 */
export async function swapExactIn({ amountIn, path, to, signer, slippageBps = SLIPPAGE_BPS }) {
  const quoted = await quote(amountIn, path);
  const minOut = (quoted.amountOut * (10_000n - slippageBps)) / 10_000n;
  const deadline = Math.floor(Date.now() / 1000) + DEADLINE_SECONDS;

  const result = await invokeAnyContract(
    config.soroswapRouterId,
    'swap_exact_tokens_for_tokens',
    [
      sc.i128(amountIn),
      sc.i128(minOut),
      sc.addressVec(path),
      sc.address(to),
      sc.u64(deadline),
    ],
    signer,
  );

  const amounts = (result.value ?? []).map((v) => BigInt(v));
  return {
    hash: result.hash,
    amountIn: amounts[0] ?? BigInt(amountIn),
    amountOut: amounts[amounts.length - 1] ?? 0n,
    quotedOut: quoted.amountOut,
    minOut,
  };
}
