/**
 * Network and deployment addresses.
 *
 * Contract ids default to `packages/scripts/deployed.json`, which the setup
 * scripts write and the repo tracks. That keeps the panels pointed at whatever
 * was last deployed with no .env to forget — the escrow id has already changed
 * once mid-build. An env var still wins, for pointing at a private deployment.
 */
import deployed from '../../../scripts/deployed.json';
export const config = {
  horizonUrl:
    process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon-testnet.stellar.org',
  sorobanRpcUrl:
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org',
  networkPassphrase:
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? 'Test SDF Network ; September 2015',
  escrowId: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID ?? deployed.escrow ?? '',
  /**
   * The validator, reached through the same-origin proxy in next.config.ts.
   * It sends no CORS headers, so calling it directly from the browser fails.
   * Override only for a validator that does send them.
   */
  validatorUrl: process.env.NEXT_PUBLIC_VALIDATOR_URL ?? '/api/validator',
  /**
   * The asset the escrow settles in, as a SAC.
   *
   * It is Circle's testnet USDC now, not the TUSDC we issued ourselves. The
   * reason is the exit: the Turkish anchor converts USDC to lira, and a payout
   * asset no anchor accepts makes the last step of the demo a mock. The old
   * id stays in `deployed.json` as a fallback so a tree that has not been
   * re-bootstrapped still reads something.
   */
  payoutSacId:
    process.env.NEXT_PUBLIC_PAYOUT_SAC_ID ??
    deployed.anchorSac ??
    deployed.tusdcSac ??
    '',
  /** What to call that asset on screen. */
  payoutAssetCode: process.env.NEXT_PUBLIC_PAYOUT_ASSET_CODE ?? 'USDC',
  explorerBase: 'https://stellar.expert/explorer/testnet',
};

export const explorerTx = (hash: string) => `${config.explorerBase}/tx/${hash}`;
export const explorerAccount = (id: string) => `${config.explorerBase}/account/${id}`;
export const explorerContract = (id: string) => `${config.explorerBase}/contract/${id}`;
