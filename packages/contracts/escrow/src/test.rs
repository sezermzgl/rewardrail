#![cfg(test)]

use super::*;
use ed25519_dalek::{Signer, SigningKey};
use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    Env, IntoVal,
};

const PER_ACTION: i128 = 4_000_000; // 0.4 units at 7 decimals
const BUDGET: i128 = 100_000_000; // 10 units

struct Fixture {
    env: Env,
    client: EscrowClient<'static>,
    token: TokenClient<'static>,
    advertiser: Address,
    platform: Address,
    publisher: Address,
    player: Address,
    signing_key: SigningKey,
    campaign_id: u64,
}

fn setup() -> Fixture {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token = TokenClient::new(&env, &sac.address());
    let minter = StellarAssetClient::new(&env, &sac.address());

    let advertiser = Address::generate(&env);
    let platform = Address::generate(&env);
    let publisher = Address::generate(&env);
    let player = Address::generate(&env);
    minter.mint(&advertiser, &(BUDGET * 10));

    let contract_id = env.register(Escrow, ());
    let client = EscrowClient::new(&env, &contract_id);

    let signing_key = SigningKey::from_bytes(&[7u8; 32]);
    let validator = BytesN::from_array(&env, &signing_key.verifying_key().to_bytes());

    let mut splits = Map::new(&env);
    splits.set(
        publisher.clone(),
        Split {
            player_bps: 3_000,
            publisher_bps: 4_500,
            platform_bps: 2_500,
        },
    );

    let campaign_id = client.open_campaign(
        &advertiser,
        &platform,
        &sac.address(),
        &validator,
        &PER_ACTION,
        &BUDGET,
        &splits,
    );

    Fixture {
        env,
        client,
        token,
        advertiser,
        platform,
        publisher,
        player,
        signing_key,
        campaign_id,
    }
}

/// Reproduces the contract's proof layout so tests sign what it verifies.
fn sign_action(f: &Fixture, action: u8) -> (BytesN<32>, BytesN<64>) {
    let action_id = BytesN::from_array(&f.env, &[action; 32]);

    let mut buf = Bytes::new(&f.env);
    buf.extend_from_array(&f.campaign_id.to_be_bytes());
    buf.append(&f.player.clone().to_xdr(&f.env));
    buf.append(&f.publisher.clone().to_xdr(&f.env));
    buf.append(&Bytes::from(action_id.clone()));

    let digest: BytesN<32> = f.env.crypto().sha256(&buf).into();
    let sig = f.signing_key.sign(&digest.to_array());
    (action_id, BytesN::from_array(&f.env, &sig.to_bytes()))
}

#[test]
fn opening_a_campaign_locks_the_budget() {
    let f = setup();
    assert_eq!(f.token.balance(&f.client.address), BUDGET);
    let campaign = f.client.get_campaign(&f.campaign_id);
    assert_eq!(campaign.remaining, BUDGET);
    assert!(campaign.open);
}

#[test]
fn settle_accrues_all_three_shares() {
    let f = setup();
    let (action_id, sig) = sign_action(&f, 1);
    f.client
        .settle(&f.campaign_id, &f.player, &f.publisher, &action_id, &sig);

    // 30 / 45 / 25 of 0.4 units
    assert_eq!(f.client.claim_of(&f.campaign_id, &f.player), 1_200_000);
    assert_eq!(f.client.claim_of(&f.campaign_id, &f.publisher), 1_800_000);
    assert_eq!(f.client.claim_of(&f.campaign_id, &f.platform), 1_000_000);

    assert_eq!(
        f.client.get_campaign(&f.campaign_id).remaining,
        BUDGET - PER_ACTION
    );
    assert!(f.client.is_settled(&action_id));

    // Nothing has left the contract yet; shares are claims, not transfers.
    assert_eq!(f.token.balance(&f.client.address), BUDGET);
}

#[test]
fn the_same_action_cannot_be_settled_twice() {
    let f = setup();
    let (action_id, sig) = sign_action(&f, 1);
    f.client
        .settle(&f.campaign_id, &f.player, &f.publisher, &action_id, &sig);

    let err = f
        .client
        .try_settle(&f.campaign_id, &f.player, &f.publisher, &action_id, &sig)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::ActionAlreadySettled);
}

#[test]
#[should_panic]
fn a_proof_signed_with_the_wrong_key_is_rejected() {
    let f = setup();
    let (action_id, _) = sign_action(&f, 1);

    let impostor = SigningKey::from_bytes(&[9u8; 32]);
    let sig = impostor.sign(&[0u8; 32]);
    let signature = BytesN::from_array(&f.env, &sig.to_bytes());

    f.client
        .settle(&f.campaign_id, &f.player, &f.publisher, &action_id, &signature);
}

#[test]
#[should_panic]
fn a_proof_cannot_be_replayed_against_a_different_player() {
    let f = setup();
    let (action_id, sig) = sign_action(&f, 1);
    let someone_else = Address::generate(&f.env);

    f.client
        .settle(&f.campaign_id, &someone_else, &f.publisher, &action_id, &sig);
}

#[test]
fn settle_is_refused_once_the_budget_runs_out() {
    let f = setup();

    // Drain the budget: 10 units / 0.4 per action = 25 actions.
    for i in 0..25u8 {
        let (action_id, sig) = sign_action(&f, i);
        f.client
            .settle(&f.campaign_id, &f.player, &f.publisher, &action_id, &sig);
    }
    assert_eq!(f.client.get_campaign(&f.campaign_id).remaining, 0);

    let (action_id, sig) = sign_action(&f, 200);
    let err = f
        .client
        .try_settle(&f.campaign_id, &f.player, &f.publisher, &action_id, &sig)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::InsufficientBudget);
}

#[test]
fn splits_that_do_not_sum_to_10000_are_rejected() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    StellarAssetClient::new(&env, &sac.address());

    let advertiser = Address::generate(&env);
    StellarAssetClient::new(&env, &sac.address()).mint(&advertiser, &BUDGET);

    let client = EscrowClient::new(&env, &env.register(Escrow, ()));
    let publisher = Address::generate(&env);

    let mut splits = Map::new(&env);
    splits.set(
        publisher,
        Split {
            player_bps: 3_000,
            publisher_bps: 4_500,
            platform_bps: 2_000, // sums to 9500
        },
    );

    let err = client
        .try_open_campaign(
            &advertiser,
            &Address::generate(&env),
            &sac.address(),
            &BytesN::from_array(&env, &[0u8; 32]),
            &PER_ACTION,
            &BUDGET,
            &splits,
        )
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::SplitsMustSumTo10000);
}

#[test]
fn publisher_withdraws_the_accrued_claim_with_no_minimum() {
    let f = setup();
    let (action_id, sig) = sign_action(&f, 1);
    f.client
        .settle(&f.campaign_id, &f.player, &f.publisher, &action_id, &sig);

    let withdrawn = f.client.withdraw(&f.campaign_id, &f.publisher);
    assert_eq!(withdrawn, 1_800_000);
    assert_eq!(f.token.balance(&f.publisher), 1_800_000);
    assert_eq!(f.client.claim_of(&f.campaign_id, &f.publisher), 0);

    let err = f
        .client
        .try_withdraw(&f.campaign_id, &f.publisher)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::NothingToWithdraw);
}

#[test]
fn clawback_refund_returns_value_to_the_budget_and_voids_the_claim() {
    let f = setup();
    let (action_id, sig) = sign_action(&f, 1);
    f.client
        .settle(&f.campaign_id, &f.player, &f.publisher, &action_id, &sig);

    let before = f.client.get_campaign(&f.campaign_id).remaining;
    f.client
        .refund_clawback(&f.campaign_id, &f.player, &1_200_000);

    assert_eq!(
        f.client.get_campaign(&f.campaign_id).remaining,
        before + 1_200_000
    );
    assert_eq!(f.client.claim_of(&f.campaign_id, &f.player), 0);
    // The action stays spent: the reward was reversed, not un-happened.
    assert!(f.client.is_settled(&action_id));
}

#[test]
fn closing_refunds_the_remainder_and_blocks_further_settles() {
    let f = setup();
    let (action_id, sig) = sign_action(&f, 1);
    f.client
        .settle(&f.campaign_id, &f.player, &f.publisher, &action_id, &sig);

    let refund = f.client.close_campaign(&f.campaign_id);
    assert_eq!(refund, BUDGET - PER_ACTION);
    assert_eq!(f.token.balance(&f.advertiser), (BUDGET * 10) - PER_ACTION);

    let (next_id, next_sig) = sign_action(&f, 2);
    let err = f
        .client
        .try_settle(&f.campaign_id, &f.player, &f.publisher, &next_id, &next_sig)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::CampaignClosed);
}

#[test]
fn claims_survive_closing_so_earned_shares_stay_withdrawable() {
    let f = setup();
    let (action_id, sig) = sign_action(&f, 1);
    f.client
        .settle(&f.campaign_id, &f.player, &f.publisher, &action_id, &sig);
    f.client.close_campaign(&f.campaign_id);

    let withdrawn = f.client.withdraw(&f.campaign_id, &f.publisher);
    assert_eq!(withdrawn, 1_800_000);
    let _: () = ().into_val(&f.env);
}
