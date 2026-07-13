.PHONY: build test check fmt lint clean

# Contract-scoped Makefile — mirrors ../Makefile but targets only this crate.
# Run from this directory: `cd packages/contracts/marketplace-escrow && make test`

WASM := ../target/wasm32-unknown-unknown/release/marketplace_escrow.wasm

## build: Compile this contract to WASM (release, size-optimised)
build:
	cargo build --target wasm32-unknown-unknown --release

## test: Run this contract's unit tests
test:
	cargo test -- --nocapture

## fmt: Format this crate's Rust source
fmt:
	cargo fmt --all

## check: Clippy lint pass (warnings = errors)
check:
	cargo clippy --all-targets -- -D warnings

## lint: Clippy lint pass (alias for check)
lint: check

## clean: Remove build artefacts
clean:
	cargo clean
