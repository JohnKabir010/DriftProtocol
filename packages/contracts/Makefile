.PHONY: build test deploy clean fmt check

# ── Config ─────────────────────────────────────────────────────────────────────
WASM         := target/wasm32-unknown-unknown/release/marketplace_escrow.wasm
NETWORK      ?= testnet
SOURCE_ACCT  ?= $(STELLAR_DEPLOY_KEY)
CONTRACT_ID_FILE := .contract-id

# ── Targets ────────────────────────────────────────────────────────────────────

## build: Compile all contracts to WASM (release, size-optimised)
build:
	cargo build --target wasm32-unknown-unknown --release

## test: Run all Soroban unit tests with snapshot output
test:
	cargo test -- --nocapture

## fmt: Format Rust source with rustfmt
fmt:
	cargo fmt --all

## check: Clippy lint pass (warnings = errors in CI)
check:
	cargo clippy --all-targets -- -D warnings

## deploy: Deploy marketplace-escrow to $(NETWORK) and save the contract ID
##
##   Prerequisites:
##     stellar CLI installed  (cargo install --locked stellar-cli)
##     STELLAR_DEPLOY_KEY env var set to the deployer secret key
##
deploy: build
	@echo "Deploying marketplace-escrow to $(NETWORK)..."
	stellar contract deploy \
		--wasm $(WASM) \
		--network $(NETWORK) \
		--source $(SOURCE_ACCT) \
	| tee $(CONTRACT_ID_FILE)
	@echo "Contract ID saved to $(CONTRACT_ID_FILE)"

## invoke-init: Initialise a freshly deployed contract
##   Usage: make invoke-init USDC=<addr> FEE_RECIPIENT=<addr> FEE_BPS=250
invoke-init:
	stellar contract invoke \
		--id $(shell cat $(CONTRACT_ID_FILE)) \
		--network $(NETWORK) \
		--source $(SOURCE_ACCT) \
		-- init \
		--usdc $(USDC) \
		--fee_recipient $(FEE_RECIPIENT) \
		--fee_bps $(FEE_BPS)

## clean: Remove build artefacts
clean:
	cargo clean
