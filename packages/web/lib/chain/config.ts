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
  tusdcSacId: process.env.NEXT_PUBLIC_TUSDC_SAC_ID ?? deployed.tusdcSac ?? '',
  explorerBase: 'https://stellar.expert/explorer/testnet',
};

export const explorerTx = (hash: string) => `${config.explorerBase}/tx/${hash}`;
export const explorerAccount = (id: string) => `${config.explorerBase}/account/${id}`;
export const explorerContract = (id: string) => `${config.explorerBase}/contract/${id}`;
