/**
 * Action proofs.
 *
 * This file has to agree byte-for-byte with `proof_message` in the escrow
 * contract. If it drifts, every settle fails with an unhelpful error, so the
 * layout is spelled out here rather than assumed.
 */
import { randomBytes, createHash } from 'node:crypto';
import { Address, xdr } from '@stellar/stellar-sdk';

import { keys } from './config.js';

/**
 * Serialize an address the way `Address::to_xdr` does inside the contract.
 *
 * soroban-sdk serializes through the value's `Val` representation, so this is
 * the XDR of an ScVal wrapping an ScAddress — not a bare ScAddress.
 */
function addressToXdr(publicKey) {
  return xdr.ScVal.scvAddress(Address.fromString(publicKey).toScAddress()).toXDR();
}

/** SHA256(campaign_id_be_u64 || player_xdr || publisher_xdr || action_id) */
export function proofDigest({ campaignId, player, publisher, actionId }) {
  const id = Buffer.alloc(8);
  id.writeBigUInt64BE(BigInt(campaignId));
  return createHash('sha256')
    .update(Buffer.concat([id, addressToXdr(player), addressToXdr(publisher), actionId]))
    .digest();
}

/**
 * Sign a completed action.
 *
 * `actionId` is random rather than derived from the player and campaign: a
 * player legitimately completing a second task in the same campaign must
 * produce a different id, or the replay guard would block real earnings.
 */
export function signAction({ campaignId, player, publisher, actionId = randomBytes(32) }) {
  const digest = proofDigest({ campaignId, player, publisher, actionId });
  // Stellar keypairs are ed25519, so the validator key signs the digest as is.
  return { actionId, signature: keys.validator.sign(digest) };
}
