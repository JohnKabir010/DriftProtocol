//! Marketplace escrow: atomic asset <-> USDC settlement for rare game assets.
//!
//! Settlement-only by design — no game logic onchain. A seller escrows a
//! registry token; a buyer fills with USDC; the swap is atomic. There is
//! deliberately NO admin withdrawal path: funds can only flow to the buyer,
//! the seller, or back to the seller on cancel/expiry.

#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    /// Listing(listing_id) -> Listing
    Listing(u64),
    NextId,
    /// USDC token contract this market settles in (set once at init).
    Usdc,
    /// Fee recipient + fee in basis points (capped at init).
    FeeConfig,
}

#[derive(Clone)]
#[contracttype]
pub struct Listing {
    pub seller: Address,
    /// SEP-41 token contract holding the escrowed asset (asset_registry series).
    pub asset_contract: Address,
    pub amount: i128,
    pub price_usdc: i128,
    /// Ledger sequence after which the seller may reclaim unilaterally.
    pub expiry_ledger: u32,
    pub active: bool,
}

#[derive(Clone)]
#[contracttype]
pub struct FeeConfig {
    pub recipient: Address,
    pub fee_bps: u32,
}

const MAX_FEE_BPS: u32 = 500; // 5% hard cap, enforced at init

#[contract]
pub struct MarketplaceEscrow;

#[contractimpl]
impl MarketplaceEscrow {
    pub fn init(env: Env, usdc: Address, fee_recipient: Address, fee_bps: u32) {
        if env.storage().instance().has(&DataKey::Usdc) {
            panic!("already initialized");
        }
        if fee_bps > MAX_FEE_BPS {
            panic!("fee above cap");
        }
        env.storage().instance().set(&DataKey::Usdc, &usdc);
        env.storage().instance().set(
            &DataKey::FeeConfig,
            &FeeConfig { recipient: fee_recipient, fee_bps },
        );
        env.storage().instance().set(&DataKey::NextId, &0u64);
    }

    /// Seller escrows the asset and opens a listing.
    pub fn list(
        env: Env,
        seller: Address,
        asset_contract: Address,
        amount: i128,
        price_usdc: i128,
        ttl_ledgers: u32,
    ) -> u64 {
        seller.require_auth();
        if amount <= 0 || price_usdc <= 0 {
            panic!("invalid amounts");
        }

        token::Client::new(&env, &asset_contract).transfer(
            &seller,
            &env.current_contract_address(),
            &amount,
        );

        let id: u64 = env.storage().instance().get(&DataKey::NextId).unwrap();
        env.storage().instance().set(&DataKey::NextId, &(id + 1));
        env.storage().persistent().set(
            &DataKey::Listing(id),
            &Listing {
                seller,
                asset_contract,
                amount,
                price_usdc,
                expiry_ledger: env.ledger().sequence() + ttl_ledgers,
                active: true,
            },
        );
        id
    }

    /// Buyer fills the listing: USDC to seller (minus fee), asset to buyer — atomic.
    pub fn buy(env: Env, buyer: Address, listing_id: u64) {
        buyer.require_auth();
        let key = DataKey::Listing(listing_id);
        let mut listing: Listing = env.storage().persistent().get(&key).expect("no listing");
        if !listing.active {
            panic!("listing closed");
        }

        let usdc: Address = env.storage().instance().get(&DataKey::Usdc).unwrap();
        let fees: FeeConfig = env.storage().instance().get(&DataKey::FeeConfig).unwrap();
        let usdc_client = token::Client::new(&env, &usdc);

        let fee = listing.price_usdc * fees.fee_bps as i128 / 10_000;
        usdc_client.transfer(&buyer, &listing.seller, &(listing.price_usdc - fee));
        if fee > 0 {
            usdc_client.transfer(&buyer, &fees.recipient, &fee);
        }
        token::Client::new(&env, &listing.asset_contract).transfer(
            &env.current_contract_address(),
            &buyer,
            &listing.amount,
        );

        listing.active = false;
        env.storage().persistent().set(&key, &listing);
    }

    /// Seller cancels (any time) or anyone may trigger refund after expiry.
    pub fn cancel(env: Env, listing_id: u64) {
        let key = DataKey::Listing(listing_id);
        let mut listing: Listing = env.storage().persistent().get(&key).expect("no listing");
        if !listing.active {
            panic!("listing closed");
        }
        if env.ledger().sequence() < listing.expiry_ledger {
            listing.seller.require_auth();
        }

        token::Client::new(&env, &listing.asset_contract).transfer(
            &env.current_contract_address(),
            &listing.seller,
            &listing.amount,
        );
        listing.active = false;
        env.storage().persistent().set(&key, &listing);
    }
}

#[cfg(test)]
mod test;
