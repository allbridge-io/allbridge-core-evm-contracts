build-contracts:
	npx hardhat compile

add-bridges:
	npx hardhat run ./scripts/bridge/add-bridge.ts --network amoy
	npx hardhat run ./scripts/bridge/add-bridge.ts --network holesky
	npx hardhat run ./scripts/bridge/add-bridge.ts --network sepolia
	npx hardhat run ./scripts/bridge/add-bridge.ts --network arbitrumSepolia


NETWORK=sepolia
#NETWORK=ava
#NETWORK=arbitrumSepolia
#NETWORK=shasta
#NETWORK=nile

add-bridge-tron:
	node ./scripts/tron/bridge/add-bridge.js --network $(NETWORK)

deploy-test-token:
	npx hardhat run ./scripts/deploy/test-token.ts --network $(NETWORK)

deploy-gas-oracle:
	npx hardhat run ./scripts/deploy/gas-oracle.ts --network $(NETWORK)

deploy-messenger:
	npx hardhat run ./scripts/deploy/messenger.ts --network $(NETWORK)

deploy-wormhole-messenger:
	npx hardhat run ./scripts/deploy/wormhole_messenger.ts --network $(NETWORK)

deploy-bridge:
	npx hardhat run ./scripts/deploy/bridge.ts --network $(NETWORK)

deploy-pool:
	npx hardhat run ./scripts/deploy/pool.ts --network $(NETWORK)

deploy-cctp-v2:
	npx hardhat run ./scripts/deploy/cctp-v2-bridge.ts --network $(NETWORK)

deploy-xreserve-bridge:
	npx hardhat run ./scripts/deploy/xreserve-bridge.ts --network $(NETWORK)

set-messenger-gas-usage:
	npx hardhat run ./scripts/messenger/set-gas-usage.ts --network $(NETWORK)

set-bridge-gas-usage:
	npx hardhat run ./scripts/bridge/set-gas-usage.ts --network $(NETWORK)

register-xreserve-bridge-destination:
	npx hardhat run ./scripts/xreserve-bridge/register-bridge-destination.ts --network $(NETWORK)

unregister-xreserve-bridge-destination:
	npx hardhat run ./scripts/xreserve-bridge/unregister-bridge-destination.ts --network $(NETWORK)

set-xreserve-bridge-admin-fee-share:
	npx hardhat run ./scripts/xreserve-bridge/set-admin-fee-share.ts --network $(NETWORK)

set-xreserve-bridge-max-fee-share:
	npx hardhat run ./scripts/xreserve-bridge/set-max-fee-share.ts --network $(NETWORK)

withdraw-xreserve-bridge-fee-in-tokens:
	npx hardhat run ./scripts/xreserve-bridge/withdraw-fee-in-tokens.ts --network $(NETWORK)

xreserve-bridge:
	npx hardhat run ./scripts/xreserve-bridge/bridge.ts --network $(NETWORK)

add-pool:
	npx hardhat run ./scripts/bridge/add-pool.ts --network $(NETWORK)

add-bridge:
	npx hardhat run ./scripts/bridge/add-bridge.ts --network $(NETWORK)

add-bridge-token:
	npx hardhat run ./scripts/bridge/add-bridge-token.ts --network $(NETWORK)


deploy-oft-bridge:
	npx hardhat run ./scripts/deploy/oft-bridge.ts --network $(NETWORK)

oft-add-chain:
	npx hardhat run ./scripts/oft-bridge/add-chain.ts --network $(NETWORK)

oft-add-token:
	npx hardhat run ./scripts/oft-bridge/add-token.ts --network $(NETWORK)

oft-set-admin-fee:
	npx hardhat run ./scripts/oft-bridge/set-admin-fee.ts --network $(NETWORK)

oft-bridge:
	npx hardhat run ./scripts/oft-bridge/bridge.ts --network $(NETWORK)

oft-get-fee:
	npx hardhat run ./scripts/oft-bridge/estimate-fee.ts --network $(NETWORK)

oft-get-receive-amount:
	npx hardhat run ./scripts/oft-bridge/get-receive-amount.ts --network $(NETWORK)

oft-set-lz-gas-limit:
	npx hardhat run ./scripts/oft-bridge/set-lz-gas-limit.ts --network $(NETWORK)

#TRON

tron-build:
	tronbox compile

tron-deploy-gas-oracle:
	tronbox migrate --f 1 --to 1 --network $(NETWORK)

tron-deploy-messenger:
	tronbox migrate --f 2 --to 2 --network $(NETWORK)

tron-deploy-bridge:
	tronbox migrate --f 3 --to 3 --network $(NETWORK)

tron-deploy-pool:
	tronbox migrate --f 5 --to 5 --network $(NETWORK)

tron-deploy-oft-bridge:
	tronbox migrate --f 6 --to 6 --network $(NETWORK)

tron-add-bridge:
	node ./scripts/tron/bridge/add-bridge.js --network $(NETWORK)

tron-add-pool:
	node ./scripts/tron/bridge/add-pool.js --network $(NETWORK)

tron-set-bridge-gas-usage:
	node ./scripts/tron/bridge/set-bridge-gas-usage.js --network $(NETWORK)

tron-oft-add-chain:
	node ./scripts/tron/oft-bridge/add-chain.js --network $(NETWORK)

tron-oft-add-token:
	node ./scripts/tron/oft-bridge/add-token.js --network $(NETWORK)

tron-oft-bridge:
	node ./scripts/tron/oft-bridge/bridge.js --network $(NETWORK)

tron-oft-set-admin-fee:
	node ./scripts/tron/oft-bridge/set-admin-fee.js --network $(NETWORK)

tron-oft-get-fee:
	node ./scripts/tron/oft-bridge/estimate-fee.js --network $(NETWORK)
