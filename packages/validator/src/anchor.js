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
    // An anchor implements one transfer standard or the other, sometimes
    // both. SEP-24 hands the user an interactive page; SEP-6 returns bank
    // instructions as data. Which one exists decides how a withdrawal runs.
    transferServerSep24: value('TRANSFER_SERVER_SEP0024'),
    transferServerSep6: value('TRANSFER_SERVER'),
    signingKey: value('SIGNING_KEY'),
    networkPassphrase: value('NETWORK_PASSPHRASE') ?? Networks.TESTNET,
  };

  if (!cachedToml.webAuthEndpoint) {
    throw new Error('anchor toml is missing its SEP-10 endpoint');
  }
  if (!cachedToml.transferServerSep24 && !cachedToml.transferServerSep6) {
    throw new Error('anchor toml offers neither SEP-24 nor SEP-6');
  }
  cachedToml.protocol = chooseProtocol(cachedToml);
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
  const base = transferServer(toml);
  const res = await fetch(`${base}/info`);
  const info = await res.json();
  const asset = info.withdraw?.[assetCode];
  if (!asset?.enabled) {
    throw new Error(`anchor does not support withdrawing ${assetCode}`);
  }
  return {
    assetCode,
    protocol: toml.protocol,
    // SEP-6 anchors often publish no bounds at all, in which case there are
    // none to enforce and `null` is the honest answer rather than a guess.
    minAmount: asset.min_amount ?? null,
    maxAmount: asset.max_amount ?? null,
    feeFixed: asset.fee_fixed ?? null,
    feePercent: asset.fee_percent ?? null,
    fiat: info.withdraw?.[assetCode]?.types ? Object.keys(asset.types) : [],
  };
}

/**
 * Pick the transfer standard for an anchor that may publish either or both.
 *
 * SEP-24 wins a tie. It hands the player to the anchor's own page for KYC and
 * payout details, which keeps bank details out of our service entirely — the
 * safer default when we have no reason to prefer otherwise. SEP-6 is used
 * when it is the only one on offer, and can be forced with ANCHOR_PROTOCOL
 * for an anchor whose SEP-6 path is the better one.
 */
function chooseProtocol(toml) {
  const forced = process.env.ANCHOR_PROTOCOL;
  if (forced === 'sep6' || forced === 'sep24') {
    const endpoint = forced === 'sep6' ? toml.transferServerSep6 : toml.transferServerSep24;
    if (!endpoint) throw new Error(`anchor does not offer ${forced}`);
    return forced;
  }
  return toml.transferServerSep24 ? 'sep24' : 'sep6';
}

/**
 * SEP-6 withdrawal: cash out to a bank account, no interactive page.
 *
 * The anchor answers with where to send the asset and what it will pay in
 * fiat. That makes it a better fit for a payout inside someone else's app
 * than SEP-24, which hands the user off to the anchor's own web flow.
 */
async function startWithdrawalSep6({ playerKeypair, assetCode, amount, token, toml }) {
  const url = new URL(`${toml.transferServerSep6}/withdraw`);
  url.searchParams.set('asset_code', assetCode);
  url.searchParams.set('type', 'bank_account');
  url.searchParams.set('account', playerKeypair.publicKey());
  url.searchParams.set('amount', String(amount));

  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  const body = await res.json();
  if (!res.ok || !body.id) {
    throw new Error(`SEP-6 withdraw failed (${res.status}): ${JSON.stringify(body)}`);
  }

  return {
    protocol: 'sep6',
    id: body.id,
    token,
    // Where the player sends the asset for the anchor to pay the fiat out.
    accountId: body.account_id,
    memo: body.memo,
    memoType: body.memo_type,
    eta: body.eta,
    feeFixed: body.fee_fixed,
    feePercent: body.fee_percent,
    extraInfo: body.extra_info,
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

  if (toml.protocol === 'sep6') {
    return startWithdrawalSep6({ playerKeypair, assetCode, amount, token, toml });
  }

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

  return { protocol: 'sep24', id: body.id, url: body.url, type: body.type, token };
}

/** Poll a withdrawal the player started. */
/** The endpoint for whichever standard was chosen. */
function transferServer(toml) {
  return toml.protocol === 'sep6' ? toml.transferServerSep6 : toml.transferServerSep24;
}

export async function withdrawalStatus({ id, token }) {
  const toml = await anchorToml();
  const base = transferServer(toml);
  const res = await fetch(`${base}/transaction?id=${id}`, {
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
    // SEP-6 reports the fiat side explicitly, which is the number the player
    // actually cares about: what lands in their bank account.
    amountInAsset: t.amount_in_asset,
    amountOutAsset: t.amount_out_asset,
  };
}
