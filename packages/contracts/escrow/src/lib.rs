#![no_std]
//! RewardRail escrow.
//!
//! Holds an advertiser's campaign budget and releases it only against an
//! action proof signed by that campaign's validator. The contract enforces
//! what the platform must not be able to bend: the share ratios, the
//! per-action amount, and that one action is paid at most once.
//!
//! The player's REWARD payment is deliberately not made here. See
//! `docs/02-technical-spec.md`, "The player's reward is a separate
//! transaction": REWARD is a classic asset whose SAC admin is the classic
//! issuer, so minting from this contract would require an issuer
//! authorization entry on every settle. The contract records the player's
//! entitlement and the validator pays it out classically.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, xdr::ToXdr, Address, Bytes,
    BytesN, Env, Map,
};

/// Share of one action's payout, in basis points. The three must sum to 10000.
#[contracttype]
#[derive(Clone)]
pub struct Split {
    pub player_bps: u32,
    pub publisher_bps: u32,
    pub platform_bps: u32,
}

#[contracttype]
#[derive(Clone)]
pub struct Campaign {
    pub advertiser: Address,
    /// Platform account. Receives its share and operates clawback refunds.
    pub platform: Address,
    /// SAC address of the asset held in escrow (TUSDC in the demo).
    pub token: Address,
    /// Ed25519 public key of the validator whose proofs this campaign accepts.
    pub validator: BytesN<32>,
    /// Total released per settled action, before splitting.
    pub per_action: i128,
    pub remaining: i128,
    /// Per-publisher ratios, fixed for the life of the campaign.
    pub splits: Map<Address, Split>,
    pub open: bool,
}

#[contracttype]
pub enum DataKey {
    NextId,
    Campaign(u64),
    /// Accrued and withdrawable by its owner: (campaign, publisher|platform).
    Claim(u64, Address),
    /// The player's entitlement. Deliberately not withdrawable by the player:
    /// the payout is owed against a REWARD token the player still holds, and
    /// only the platform can confirm that token was burned. Without this
    /// split a player could withdraw the escrowed value and keep the reward.
    Reserve(u64, Address),
    /// Spent action ids, the replay guard.
    Spent(BytesN<32>),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    CampaignNotFound = 1,
    CampaignClosed = 2,
    SplitsMustSumTo10000 = 3,
    UnknownPublisher = 4,
    InvalidProof = 5,
    ActionAlreadySettled = 6,
    InsufficientBudget = 7,
    NothingToWithdraw = 8,
    InvalidAmount = 9,
    NoSplits = 10,
}

const BPS_TOTAL: u32 = 10_000;

/// Roughly 30 days at 5 second ledgers, comfortably past any demo.
const TTL_THRESHOLD: u32 = 100_000;
const TTL_EXTEND: u32 = 518_400;

#[contract]
pub struct Escrow;

#[contractimpl]
impl Escrow {
    /// Lock a budget and register the campaign. Returns the campaign id.
    ///
    /// `splits` fixes each publisher's ratio up front. There is intentionally
    /// no function to change it later: the advertiser's guarantee is that the
    /// table it approved is the table that runs.
    pub fn open_campaign(
        env: Env,
        advertiser: Address,
        platform: Address,
        token_address: Address,
        validator: BytesN<32>,
        per_action: i128,
        budget: i128,
        splits: Map<Address, Split>,
    ) -> Result<u64, Error> {
        advertiser.require_auth();

        if per_action <= 0 || budget <= 0 || budget < per_action {
            return Err(Error::InvalidAmount);
        }
        if splits.is_empty() {
            return Err(Error::NoSplits);
        }
        for (_, split) in splits.iter() {
            let sum = split
                .player_bps
                .checked_add(split.publisher_bps)
                .and_then(|s| s.checked_add(split.platform_bps))
                .ok_or(Error::SplitsMustSumTo10000)?;
            if sum != BPS_TOTAL {
                return Err(Error::SplitsMustSumTo10000);
            }
        }

        token::Client::new(&env, &token_address).transfer(
            &advertiser,
            &env.current_contract_address(),
            &budget,
        );

        let id: u64 = env.storage().instance().get(&DataKey::NextId).unwrap_or(0);
        env.storage().instance().set(&DataKey::NextId, &(id + 1));

        let campaign = Campaign {
            advertiser,
            platform,
            token: token_address,
            validator,
            per_action,
            remaining: budget,
            splits,
            open: true,
        };
        put_campaign(&env, id, &campaign);
        Ok(id)
    }

    /// Record a verified action and accrue all three shares.
    ///
    /// The amount is never taken from the proof. It is derived from
    /// `per_action` and the publisher's row in `splits`, so a compromised
    /// validator key cannot change how much is paid, only who is paid.
    pub fn settle(
        env: Env,
        campaign_id: u64,
        player: Address,
        publisher: Address,
        action_id: BytesN<32>,
        signature: BytesN<64>,
    ) -> Result<(), Error> {
        let mut campaign = get_campaign(&env, campaign_id)?;
        if !campaign.open {
            return Err(Error::CampaignClosed);
        }
        if env.storage().persistent().has(&DataKey::Spent(action_id.clone())) {
            return Err(Error::ActionAlreadySettled);
        }
        let split = campaign
            .splits
            .get(publisher.clone())
            .ok_or(Error::UnknownPublisher)?;
        if campaign.remaining < campaign.per_action {
            return Err(Error::InsufficientBudget);
        }

        let message = proof_message(&env, campaign_id, &player, &publisher, &action_id);
        env.crypto()
            .ed25519_verify(&campaign.validator, &message, &signature);

        // Player and platform take their basis points; the publisher takes the
        // remainder so rounding never leaves dust stranded in the campaign.
        let player_amount = campaign.per_action * i128::from(split.player_bps) / i128::from(BPS_TOTAL);
        let platform_amount =
            campaign.per_action * i128::from(split.platform_bps) / i128::from(BPS_TOTAL);
        let publisher_amount = campaign.per_action - player_amount - platform_amount;

        campaign.remaining -= campaign.per_action;
        put_campaign(&env, campaign_id, &campaign);

        add_amount(&env, &DataKey::Reserve(campaign_id, player), player_amount);
        add_amount(&env, &DataKey::Claim(campaign_id, publisher), publisher_amount);
        add_amount(
            &env,
            &DataKey::Claim(campaign_id, campaign.platform.clone()),
            platform_amount,
        );

        // The replay guard is only as durable as its TTL. Without this bump
        // the entry expires and the same action becomes payable again.
        let spent = DataKey::Spent(action_id);
        env.storage().persistent().set(&spent, &true);
        env.storage()
            .persistent()
            .extend_ttl(&spent, TTL_THRESHOLD, TTL_EXTEND);

        Ok(())
    }

    /// Withdraw an accrued claim. No minimum: the no-threshold principle
    /// applies on this side of the protocol too.
    pub fn withdraw(env: Env, campaign_id: u64, who: Address) -> Result<i128, Error> {
        who.require_auth();

        let campaign = get_campaign(&env, campaign_id)?;
        let key = DataKey::Claim(campaign_id, who.clone());
        let amount: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if amount <= 0 {
            return Err(Error::NothingToWithdraw);
        }

        env.storage().persistent().set(&key, &0i128);
        token::Client::new(&env, &campaign.token).transfer(
            &env.current_contract_address(),
            &who,
            &amount,
        );
        Ok(amount)
    }

    /// Return a clawed-back reward to the campaign budget.
    ///
    /// The amount is the player's own reserve, never a number the caller
    /// supplies. An `amount` parameter would let the platform inflate
    /// `remaining` past what the escrow actually holds, and the first
    /// withdrawal to hit the shortfall would be the one that failed.
    ///
    /// The action stays marked spent on purpose. The reward was reversed, not
    /// un-happened, and letting the id be reused would reopen the replay hole.
    pub fn refund_clawback(env: Env, campaign_id: u64, player: Address) -> Result<i128, Error> {
        let mut campaign = get_campaign(&env, campaign_id)?;
        campaign.platform.require_auth();

        let key = DataKey::Reserve(campaign_id, player);
        let reserve: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if reserve <= 0 {
            return Err(Error::NothingToWithdraw);
        }

        env.storage().persistent().set(&key, &0i128);
        campaign.remaining += reserve;
        put_campaign(&env, campaign_id, &campaign);
        Ok(reserve)
    }

    /// Pay a player's reserve out to that player.
    ///
    /// Only the platform can call this, and the destination is fixed to the
    /// player, so the platform can withhold but never redirect. The platform
    /// is the only party that can confirm the matching REWARD was burned,
    /// which is the condition this payout is owed against.
    pub fn redeem_player(env: Env, campaign_id: u64, player: Address) -> Result<i128, Error> {
        let campaign = get_campaign(&env, campaign_id)?;
        campaign.platform.require_auth();

        let key = DataKey::Reserve(campaign_id, player.clone());
        let amount: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if amount <= 0 {
            return Err(Error::NothingToWithdraw);
        }

        env.storage().persistent().set(&key, &0i128);
        token::Client::new(&env, &campaign.token).transfer(
            &env.current_contract_address(),
            &player,
            &amount,
        );
        Ok(amount)
    }

    /// Close the campaign and return what was never spent.
    pub fn close_campaign(env: Env, campaign_id: u64) -> Result<i128, Error> {
        let mut campaign = get_campaign(&env, campaign_id)?;
        campaign.advertiser.require_auth();
        if !campaign.open {
            return Err(Error::CampaignClosed);
        }

        let refund = campaign.remaining;
        campaign.remaining = 0;
        campaign.open = false;
        put_campaign(&env, campaign_id, &campaign);

        if refund > 0 {
            token::Client::new(&env, &campaign.token).transfer(
                &env.current_contract_address(),
                &campaign.advertiser,
                &refund,
            );
        }
        Ok(refund)
    }

    pub fn get_campaign(env: Env, campaign_id: u64) -> Result<Campaign, Error> {
        get_campaign(&env, campaign_id)
    }

    pub fn claim_of(env: Env, campaign_id: u64, who: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Claim(campaign_id, who))
            .unwrap_or(0)
    }

    pub fn reserve_of(env: Env, campaign_id: u64, player: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Reserve(campaign_id, player))
            .unwrap_or(0)
    }

    pub fn is_settled(env: Env, action_id: BytesN<32>) -> bool {
        env.storage().persistent().has(&DataKey::Spent(action_id))
    }
}

/// The bytes the validator signs.
///
/// Binding campaign, player, publisher and action together means a leaked
/// proof cannot be replayed against a different player or campaign. The
/// validator reproduces this layout off chain; see the validator package.
fn proof_message(
    env: &Env,
    campaign_id: u64,
    player: &Address,
    publisher: &Address,
    action_id: &BytesN<32>,
) -> Bytes {
    let mut buf = Bytes::new(env);
    buf.extend_from_array(&campaign_id.to_be_bytes());
    buf.append(&player.clone().to_xdr(env));
    buf.append(&publisher.clone().to_xdr(env));
    buf.append(&Bytes::from(action_id.clone()));
    env.crypto().sha256(&buf).into()
}

fn get_campaign(env: &Env, id: u64) -> Result<Campaign, Error> {
    let key = DataKey::Campaign(id);
    let campaign: Campaign = env
        .storage()
        .persistent()
        .get(&key)
        .ok_or(Error::CampaignNotFound)?;
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND);
    Ok(campaign)
}

fn put_campaign(env: &Env, id: u64, campaign: &Campaign) {
    let key = DataKey::Campaign(id);
    env.storage().persistent().set(&key, campaign);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND);
}

fn add_amount(env: &Env, key: &DataKey, amount: i128) {
    if amount <= 0 {
        return;
    }
    let current: i128 = env.storage().persistent().get(key).unwrap_or(0);
    env.storage().persistent().set(key, &(current + amount));
    env.storage()
        .persistent()
        .extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND);
}

#[cfg(test)]
mod test;
