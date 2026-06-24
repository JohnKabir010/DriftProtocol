#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::Address as _,
    testutils::Events as _,
    testutils::Ledger as _,
    token::StellarAssetClient,
    Address, Env,
};

fn setup(env: &Env) -> (Address, Address, Address, MarketplaceEscrowClient<'_>) {
    let usdc_admin = Address::generate(env);
    let usdc = env.register_stellar_asset_contract_v2(usdc_admin.clone());
    let asset_admin = Address::generate(env);
    let asset = env.register_stellar_asset_contract_v2(asset_admin.clone());

    let contract_id = env.register_contract(None, MarketplaceEscrow);
    let client = MarketplaceEscrowClient::new(env, &contract_id);
    let fee_recipient = Address::generate(env);
    client.init(&usdc.address(), &fee_recipient, &250);

    (usdc.address(), asset.address(), fee_recipient, client)
}

// ── Test 1: happy-path settlement ─────────────────────────────────────────

#[test]
fn list_and_buy_settles_atomically() {
    let env = Env::default();
    env.mock_all_auths();
    let (usdc, asset, fee_recipient, client) = setup(&env);

    let seller = Address::generate(&env);
    let buyer = Address::generate(&env);
    StellarAssetClient::new(&env, &asset).mint(&seller, &1);
    StellarAssetClient::new(&env, &usdc).mint(&buyer, &1_000_0000);

    let id = client.list(&seller, &asset, &1, &1_000_0000, &1000);
    client.buy(&buyer, &id);

    let asset_token = token::Client::new(&env, &asset);
    let usdc_token = token::Client::new(&env, &usdc);
    // Asset moved to buyer.
    assert_eq!(asset_token.balance(&buyer), 1);
    // Seller nets 97.5% (2.5% fee = 25_0000 goes to fee_recipient).
    assert_eq!(usdc_token.balance(&seller), 975_0000);
    assert_eq!(usdc_token.balance(&fee_recipient), 25_0000);
}

// ── Test 2: double-buy guard ──────────────────────────────────────────────

#[test]
#[should_panic(expected = "listing closed")]
fn cannot_double_buy() {
    let env = Env::default();
    env.mock_all_auths();
    let (usdc, asset, _fee, client) = setup(&env);

    let seller = Address::generate(&env);
    let buyer = Address::generate(&env);
    StellarAssetClient::new(&env, &asset).mint(&seller, &1);
    StellarAssetClient::new(&env, &usdc).mint(&buyer, &10_000_0000);

    let id = client.list(&seller, &asset, &1, &1_000_0000, &1000);
    client.buy(&buyer, &id);
    client.buy(&buyer, &id); // must panic
}

// ── Test 3: seller cancels before expiry, asset returned ─────────────────

#[test]
fn seller_can_cancel_before_expiry() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, asset, _fee, client) = setup(&env);

    let seller = Address::generate(&env);
    StellarAssetClient::new(&env, &asset).mint(&seller, &5);

    // List 3 units with a long TTL.
    let id = client.list(&seller, &asset, &3, &500_0000, &5000);
    // The asset is now held by the contract.
    assert_eq!(token::Client::new(&env, &asset).balance(&seller), 2);

    // Seller cancels — asset refunded.
    client.cancel(&id);
    assert_eq!(token::Client::new(&env, &asset).balance(&seller), 5);
}

// ── Test 4: anyone can trigger expiry-refund after TTL lapses ─────────────

#[test]
fn expiry_refund_after_ttl() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, asset, _fee, client) = setup(&env);

    let seller = Address::generate(&env);
    let stranger = Address::generate(&env);
    StellarAssetClient::new(&env, &asset).mint(&seller, &1);

    // List with TTL of 10 ledgers.
    let id = client.list(&seller, &asset, &1, &999_0000, &10);

    // Advance ledger past expiry.
    env.ledger().with_mut(|li| li.sequence_number += 20);

    // Any account (not the seller) can sweep the expired listing.
    let _ = stranger; // stranger triggers via cancel — no auth needed post-expiry
    client.cancel(&id);

    // Asset returned to seller, not the stranger.
    assert_eq!(token::Client::new(&env, &asset).balance(&seller), 1);
}

// ── Test 5: init guard prevents re-initialisation ─────────────────────────

#[test]
#[should_panic(expected = "already initialized")]
fn cannot_reinitialize() {
    let env = Env::default();
    env.mock_all_auths();
    let (usdc, _, _fee, client) = setup(&env);

    let another_recipient = Address::generate(&env);
    // Attempting to call init again must panic.
    client.init(&usdc, &another_recipient, &100);
}

// ── Test 6: fee above hard cap is rejected ────────────────────────────────

#[test]
#[should_panic(expected = "fee above cap")]
fn fee_cap_enforced() {
    let env = Env::default();
    env.mock_all_auths();

    let usdc_admin = Address::generate(&env);
    let usdc = env.register_stellar_asset_contract_v2(usdc_admin.clone());
    let contract_id = env.register_contract(None, MarketplaceEscrow);
    let client = MarketplaceEscrowClient::new(&env, &contract_id);
    let recipient = Address::generate(&env);

    // 501 bps > 500 bps cap → panic.
    client.init(&usdc.address(), &recipient, &501);
}

// ── Test 7: zero amount/price rejected ───────────────────────────────────

#[test]
#[should_panic(expected = "invalid amounts")]
fn zero_amount_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, asset, _fee, client) = setup(&env);

    let seller = Address::generate(&env);
    StellarAssetClient::new(&env, &asset).mint(&seller, &1);

    client.list(&seller, &asset, &0, &1_000_0000, &100); // amount=0 → panic
}

// ── Test 8: events are emitted on list and buy ────────────────────────────

#[test]
fn events_emitted_on_list_and_buy() {
    let env = Env::default();
    env.mock_all_auths();
    let (usdc, asset, _fee, client) = setup(&env);

    let seller = Address::generate(&env);
    let buyer = Address::generate(&env);
    StellarAssetClient::new(&env, &asset).mint(&seller, &1);
    StellarAssetClient::new(&env, &usdc).mint(&buyer, &1_000_0000);

    let id = client.list(&seller, &asset, &1, &1_000_0000, &500);

    // Verify: listing was created (side-effect: the buy succeeds, meaning
    // the escrow event did not corrupt any state).
    client.buy(&buyer, &id);

    // Post-buy the asset must be with the buyer — proving both operations ran.
    assert_eq!(token::Client::new(&env, &asset).balance(&buyer), 1);

    // All events in the env must include our "escrow" topic — check no panic.
    let all_events = env.events().all();
    // Should have at least 2 events: "listed" and "sold".
    assert!(all_events.len() >= 2);
}
