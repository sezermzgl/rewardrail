/**
 * Anchor integration — the last mile from a Stellar balance to real money.
 *
 * This talks to the SDF reference anchor on testnet, not a mock. SEP-10
 * authenticates the player's account, SEP-24 opens a withdrawal the anchor
 * itself tracks. The interactive URL that comes back is the anchor's own
 * KYC and payout page.
 *
 * What is genuinely real here: the authentication, the withdrawal record,
 * and the status transitions. What is not: the anchor is a test deployment
 * that pays no actual fiat, and its asset is SRT rather than a production
 * stablecoin. Say both out loud rather than letting anyone assume otherwise.
 */
import { TransactionBuilder, Networks } from '@stellar/stellar-sdk';

import { config } from './config.js';

const DEFAULT_HOME_DOMAIN = 'testanchor.stellar.org';

let cachedToml = null;

/**
 * The anchor's stellar.toml is the discovery document: it names the auth
 * endpoint, the transfer server and the signing key we verify challenges
 * against. Hardcoding those URLs would work until the anchor moved.
 */
export async function anchorToml() {
  if (cachedToml) return cachedToml;

  const domain = config.anchorHomeDomain ?? DEFAULT_HOME_DOMAIN;
  const res = await fetch(`https://${domain}/.well-known/stellar.toml`);
  if (!res.ok) throw new Error(`anchor toml unreachable (${res.status})`);
  const text = await res.text();

  const value = (key) => text.match(new RegExp(`^${key}\\s*=\\s*"([^"]+)"`, 'm'))?.[1];

  cachedToml = {
    homeDomain: domain,
    webAuthEndpoint: value('WEB_AUTH_ENDPOINT'),
    transferServerSep24: value('TRANSFER_SERVER_SEP0024'),
    signingKey: value('SIGNING_KEY'),
    networkPassphrase: value('NETWORK_PASSPHRASE') ?? Networks.TESTNET,
  };

  if (!cachedToml.webAuthEndpoint || !cachedToml.transferServerSep24) {
    throw new Error('anchor toml is missing SEP-10 or SEP-24 endpoints');
  }
  return cachedToml;
}

/**
 * SEP-10: prove the player controls their account and get a session token.
 *
 * The player signs the challenge, which the backend can do because the key
 * is custodial. The challenge's source must be the anchor's declared signing
 * key — checking that is what stops a spoofed auth server from harvesting
 * signatures.
 */
export async function authenticate(playerKeypair) {
  const toml = await anchorToml();

  const url = `${toml.webAuthEndpoint}?account=${playerKeypair.publicKey()}&home_domain=${toml.homeDomain}`;
  const challengeRes = await fetch(url);
  if (!challengeRes.ok) {
    throw new Error(`SEP-10 challenge failed (${challengeRes.status})`);
  }
  const { transaction, network_passphrase } = await challengeRes.json();

  const tx = TransactionBuilder.fromXDR(
    transaction,
    network_passphrase ?? toml.networkPassphrase,
  );
  if (tx.source !== toml.signingKey) {
    throw new Error('SEP-10 challenge was not signed by the anchor in its toml');
  }
  tx.sign(playerKeypair);

  const tokenRes = await fetch(toml.webAuthEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ transaction: tx.toXDR() }),
  });
  const body = await tokenRes.json();
  if (!body.token) {
    throw new Error(`SEP-10 token exchange failed: ${JSON.stringify(body)}`);
  }
  return body.token;
}

/** What the anchor will accept, and within what bounds. */
export async function withdrawInfo(assetCode) {
  const toml = await anchorToml();
  const res = await fetch(`${toml.transferServerSep24}/info`);
  const info = await res.json();
  const asset = info.withdraw?.[assetCode];
  if (!asset?.enabled) {
    throw new Error(`anchor does not support withdrawing ${assetCode}`);
  }
  return {
    assetCode,
    minAmount: asset.min_amount,
    maxAmount: asset.max_amount,
    feeFixed: asset.fee_fixed,
    feePercent: asset.fee_percent,
  };
}

/**
 * Open a withdrawal. Returns the anchor's transaction id and the interactive
 * URL where the player completes KYC and gives their payout details.
 *
 * The URL is the anchor's, not ours. We never see the player's bank details,
 * which is the whole point of SEP-24 being interactive.
 */
export async function startWithdrawal({ playerKeypair, assetCode, amount }) {
  const toml = await anchorToml();
  const token = await authenticate(playerKeypair);

  const res = await fetch(`${toml.transferServerSep24}/transactions/withdraw/interactive`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({
      asset_code: assetCode,
      account: playerKeypair.publicKey(),
      amount: String(amount),
    }),
  });
  const body = await res.json();
  if (!res.ok || !body.id) {
    throw new Error(`SEP-24 withdraw failed (${res.status}): ${JSON.stringify(body)}`);
  }

  return { id: body.id, url: body.url, type: body.type, token };
}

/** Poll a withdrawal the player started. */
export async function withdrawalStatus({ id, token }) {
  const toml = await anchorToml();
  const res = await fetch(`${toml.transferServerSep24}/transaction?id=${id}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`status lookup failed (${res.status})`);
  const t = body.transaction ?? {};
  return {
    id: t.id,
    status: t.status,
    amountIn: t.amount_in,
    amountFee: t.amount_fee,
    amountOut: t.amount_out,
    message: t.message,
    // Where the player must send the asset for the anchor to pay them out.
    withdrawAnchorAccount: t.withdraw_anchor_account,
    withdrawMemo: t.withdraw_memo,
    withdrawMemoType: t.withdraw_memo_type,
  };
}
