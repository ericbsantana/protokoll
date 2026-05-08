# protokoll dev/deploy runner.
#
# Common workflows:
#   make test                                    # forge + vitest
#   make refresh                                 # regenerate fixtures, run tests, refresh snapshot
#   make keygen                                  # mint a fresh oracle BLS12-381 keypair
#   make deploy-dryrun                           # simulate deploy on testnet (default)
#   make deploy-dryrun NETWORK=mainnet           # simulate deploy on mainnet
#   make deploy-broadcast                        # broadcast on testnet (requires .env)
#   make deploy-verify ADAPTER=0x.. VERIFIER=0x..
#
#   make oracle                                  # run the oracle against NETWORK's adapter
#   make smoke-deploy                            # deploy a SmokeConsumer wired to ADAPTER
#   make smoke-request CONSUMER=0x.. ROUND=foo   # request randomness from a SmokeConsumer
#   make smoke-status  CONSUMER=0x..             # read SmokeConsumer.lastBeta after fulfill
#
# Network selection is driven by the makefile, not your shell environment.
# Override only via "make NETWORK=mainnet ..." on the command line.
#
# .env must contain PRIVATE_KEY, ORACLE_PUBLIC_KEY (128-byte hex with 0x prefix),
# and optionally REQUEST_FEE_WEI (defaults to 0). Any RPC_URL / ETH_RPC_URL in
# .env or your shell is intentionally ignored - this Makefile picks the URL.

SHELL := /usr/bin/env bash
.SHELLFLAGS := -eu -o pipefail -c

# ── Network selection ─────────────────────────────────────────────────────────
# Simple `:=` assignment: command line can override (`make NETWORK=mainnet`),
# but environment variables cannot. Default is testnet.
NETWORK := testnet

ifeq ($(NETWORK),testnet)
  RPC_URL := https://testnet-rpc.monad.xyz
  CHAIN_ID := 10143
else ifeq ($(NETWORK),mainnet)
  $(error mainnet deploys require an EVM chain with EIP-2537 precompiles enabled - not yet supported)
else
  $(error unsupported NETWORK=$(NETWORK); supported: testnet)
endif

# ── Secret loading ────────────────────────────────────────────────────────────
# Load only the three keys we actually need from .env, and unset any RPC-related
# vars that might otherwise be picked up by forge or cast. Pass --rpc-url with
# the literal URL (not a foundry.toml alias) so there is one source of truth.
LOAD_SECRETS = \
	if [ -f .env ]; then \
	  export PRIVATE_KEY="$$(grep -E '^PRIVATE_KEY=' .env | head -1 | cut -d= -f2-)"; \
	  export ORACLE_PUBLIC_KEY="$$(grep -E '^ORACLE_PUBLIC_KEY=' .env | head -1 | cut -d= -f2-)"; \
	  export REQUEST_FEE_WEI="$$(grep -E '^REQUEST_FEE_WEI=' .env | head -1 | cut -d= -f2-)"; \
	  export ORACLE_K="$$(grep -E '^ORACLE_K=' .env | head -1 | cut -d= -f2-)"; \
	  export ORACLE_PRIVATE_KEY="$$(grep -E '^ORACLE_PRIVATE_KEY=' .env | head -1 | cut -d= -f2-)"; \
	  export ADAPTER_ADDRESS="$$(grep -E '^ADAPTER_ADDRESS=' .env | head -1 | cut -d= -f2-)"; \
	fi; \
	if [ -z "$$ORACLE_PRIVATE_KEY" ] && [ -n "$$PRIVATE_KEY" ]; then \
	  export ORACLE_PRIVATE_KEY="$$PRIVATE_KEY"; \
	fi; \
	unset ETH_RPC_URL FOUNDRY_RPC_URL RPC_URL;

.PHONY: help test test-forge test-vitest fixtures snapshot refresh keygen \
        deploy-dryrun deploy-broadcast deploy-verify \
        oracle smoke-deploy smoke-request smoke-status clean

help:
	@echo "  network: NETWORK=$(NETWORK)  (rpc=$(RPC_URL), chainId=$(CHAIN_ID))"
	@echo
	@grep -E '^[a-zA-Z_-]+:.*?##' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  %-22s %s\n", $$1, $$2}'

test: test-forge test-vitest ## Run forge + vitest suites

test-forge: ## Run Foundry tests
	forge test

test-vitest: ## Run vitest suites
	npx vitest run

fixtures: ## Regenerate VRF fixtures (rewrites the test files in place)
	npx tsx src/scripts/refreshFixtures.ts

keygen: ## Generate a fresh oracle BLS12-381 keypair (k, Y=k·G)
	@npx tsx src/scripts/genOracleKey.ts

snapshot: ## Refresh .gas-snapshot
	forge snapshot

refresh: fixtures test-forge snapshot ## Full DST/key change workflow: fixtures + tests + snapshot
	@echo "✓ fixtures regenerated, forge tests pass, gas snapshot refreshed"

deploy-dryrun: ## Simulate deploy on NETWORK without broadcasting
	@echo "→ network: $(NETWORK)  rpc: $(RPC_URL)"
	@$(LOAD_SECRETS) \
	forge script script/Deploy.s.sol --rpc-url $(RPC_URL)

deploy-broadcast: ## Broadcast deploy on NETWORK. REQUIRES funded PRIVATE_KEY in .env
	@echo "→ network: $(NETWORK)  rpc: $(RPC_URL)"
	@$(LOAD_SECRETS) \
	if [ -z "$$PRIVATE_KEY" ]; then echo "PRIVATE_KEY missing from .env"; exit 1; fi; \
	forge script script/Deploy.s.sol \
	  --rpc-url $(RPC_URL) \
	  --broadcast \
	  --private-key "$$PRIVATE_KEY"

deploy-verify: ## Confirm on-chain state. Pass ADAPTER=0x.. VERIFIER=0x..
	@if [ -z "$(ADAPTER)" ] || [ -z "$(VERIFIER)" ]; then \
	  echo "usage: make deploy-verify ADAPTER=0x... VERIFIER=0x... [NETWORK=testnet]"; exit 1; \
	fi
	@echo "→ network: $(NETWORK)  rpc: $(RPC_URL)"
	@unset ETH_RPC_URL FOUNDRY_RPC_URL RPC_URL; \
	echo "→ verifier address registered with adapter:"; \
	cast call $(ADAPTER) 'verifier()(address)' --rpc-url $(RPC_URL); \
	echo "→ requestFee (wei):"; \
	cast call $(ADAPTER) 'requestFee()(uint256)' --rpc-url $(RPC_URL); \
	echo "→ CALLBACK_GAS_LIMIT:"; \
	cast call $(ADAPTER) 'CALLBACK_GAS_LIMIT()(uint256)' --rpc-url $(RPC_URL); \
	echo "→ oracle public key (must match the off-chain oracle):"; \
	cast call $(ADAPTER) 'oraclePublicKey()(bytes)' --rpc-url $(RPC_URL); \
	echo "→ verifier code size (sanity, must be > 0):"; \
	cast code $(VERIFIER) --rpc-url $(RPC_URL) | wc -c

oracle: ## Run the oracle service against NETWORK's adapter (long-running)
	@echo "→ network: $(NETWORK)  rpc: $(RPC_URL)"
	@$(LOAD_SECRETS) \
	if [ -z "$$ORACLE_K" ];          then echo "ORACLE_K missing from .env"; exit 1; fi; \
	if [ -z "$$ORACLE_PRIVATE_KEY" ];then echo "ORACLE_PRIVATE_KEY missing (or PRIVATE_KEY fallback) from .env"; exit 1; fi; \
	if [ -z "$$ADAPTER_ADDRESS" ];   then echo "ADAPTER_ADDRESS missing from .env"; exit 1; fi; \
	echo "→ adapter: $$ADAPTER_ADDRESS"; \
	CHAIN_ID=$(CHAIN_ID) npx tsx src/oracle/index.ts

smoke-deploy: ## Deploy a SmokeConsumer wired to ADAPTER (defaults to .env ADAPTER_ADDRESS)
	@$(LOAD_SECRETS) \
	if [ -n "$(ADAPTER)" ]; then export SMOKE_ADAPTER="$(ADAPTER)"; \
	elif [ -n "$$ADAPTER_ADDRESS" ]; then export SMOKE_ADAPTER="$$ADAPTER_ADDRESS"; \
	else echo "set ADAPTER=0x... or ADAPTER_ADDRESS in .env"; exit 1; fi; \
	if [ -z "$$PRIVATE_KEY" ]; then echo "PRIVATE_KEY missing from .env"; exit 1; fi; \
	echo "→ deploying SmokeConsumer wired to $$SMOKE_ADAPTER"; \
	forge script script/DeploySmoke.s.sol \
	  --rpc-url $(RPC_URL) \
	  --broadcast \
	  --private-key "$$PRIVATE_KEY"

smoke-request: ## Call CONSUMER.request(ROUND). Pass CONSUMER=0x.. ROUND=<string>
	@if [ -z "$(CONSUMER)" ] || [ -z "$(ROUND)" ]; then \
	  echo "usage: make smoke-request CONSUMER=0x... ROUND=smoke-1"; exit 1; \
	fi
	@$(LOAD_SECRETS) \
	if [ -z "$$PRIVATE_KEY" ]; then echo "PRIVATE_KEY missing from .env"; exit 1; fi; \
	ROUND_BYTES=$$(cast format-bytes32-string "$(ROUND)"); \
	echo "→ funding consumer with 0.01 MON (covers requestFee + buffer)"; \
	cast send $(CONSUMER) --value 0.01ether \
	  --rpc-url $(RPC_URL) --private-key "$$PRIVATE_KEY" >/dev/null; \
	echo "→ requesting roundId=$(ROUND) ($$ROUND_BYTES)"; \
	cast send $(CONSUMER) "request(bytes32)" "$$ROUND_BYTES" \
	  --rpc-url $(RPC_URL) --private-key "$$PRIVATE_KEY"

smoke-status: ## Read CONSUMER.lastRoundId / lastBeta. Pass CONSUMER=0x..
	@if [ -z "$(CONSUMER)" ]; then \
	  echo "usage: make smoke-status CONSUMER=0x..."; exit 1; \
	fi
	@unset ETH_RPC_URL FOUNDRY_RPC_URL RPC_URL; \
	echo "→ callbackReceived:"; \
	cast call $(CONSUMER) "callbackReceived()(bool)" --rpc-url $(RPC_URL); \
	echo "→ lastRoundId:"; \
	cast call $(CONSUMER) "lastRoundId()(bytes32)" --rpc-url $(RPC_URL); \
	echo "→ lastBeta:"; \
	cast call $(CONSUMER) "lastBeta()(bytes32)" --rpc-url $(RPC_URL)

clean: ## Remove forge build artifacts
	forge clean
