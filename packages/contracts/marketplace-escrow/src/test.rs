#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, token::StellarAssetClient, Address, Env};

fn setup(env: &Env) -> (Address, Address, MarketplaceEscrowClient<'_>) {
    let usdc_admin = Address::generate(env);
    let usdc = env.register_stellar_asset_contract_v2(usdc_admin.clone());
    let asset_admin = Address::generate(env);
    let asset = env.register_stellar_asset_contract_v2(asset_admin.clone());

    let contract_id = env.register(MarketplaceEscrow, ());
    let client = MarketplaceEscrowClient::new(env, &contract_id);
    let fee_recipient = Address::generate(env);
    client.init(&usdc.address(), &fee_recipient, &250);

    (usdc.address(), asset.address(), client)
}

#[test]
fn list_and_buy_settles_atomically() {
    let env = Env::default();
    env.mock_all_auths();
    let (usdc, asset, client) = setup(&env);

    let seller = Address::generate(&env);
    let buyer = Address::generate(&env);
    StellarAssetClient::new(&env, &asset).mint(&seller, &1);
    StellarAssetClient::new(&env, &usdc).mint(&buyer, &1_000_0000);

    let id = client.list(&seller, &asset, &1, &1_000_0000, &1000);
    client.buy(&buyer, &id);

    let asset_token = token::Client::new(&env, &asset);
    let usdc_token = token::Client::new(&env, &usdc);
    assert_eq!(asset_token.balance(&buyer), 1);
    // 2.5% fee: seller nets 975.0000.
    assert_eq!(usdc_token.balance(&seller), 975_0000);
}

#[test]
#[should_panic(expected = "listing closed")]
fn cannot_double_buy() {
    let env = Env::default();
    env.mock_all_auths();
    let (usdc, asset, client) = setup(&env);

    let seller = Address::generate(&env);
    let buyer = Address::generate(&env);
    StellarAssetClient::new(&env, &asset).mint(&seller, &1);
    StellarAssetClient::new(&env, &usdc).mint(&buyer, &10_000_0000);

    let id = client.list(&seller, &asset, &1, &1_000_0000, &1000);
    client.buy(&buyer, &id);
    client.buy(&buyer, &id);
}
