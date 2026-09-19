/**
 * Network and deployment addresses.
 *
 * Testnet defaults are inline so a panel renders without a .env, which matters
 * during a demo. NEXT_PUBLIC_ prefixes keep the values readable in the browser.
 */
export const config = {
  horizonUrl:
    process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon-testnet.stellar.org',
  sorobanRpcUrl:
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org',
  networkPassphrase:
    process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? 'Test SDF Network ; September 2015',
  escrowId: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID ?? '',
  tusdcSacId: process.env.NEXT_PUBLIC_TUSDC_SAC_ID ?? '',
  explorerBase: 'https://stellar.expert/explorer/testnet',
};

export const explorerTx = (hash: string) => `${config.explorerBase}/tx/${hash}`;
export const explorerAccount = (id: string) => `${config.explorerBase}/account/${id}`;
export const explorerContract = (id: string) => `${config.explorerBase}/contract/${id}`;
