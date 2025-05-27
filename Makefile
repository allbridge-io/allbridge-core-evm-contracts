build-contracts:
	npx hardhat compile

add-bridges:
	npx hardhat run ./scripts/bridge/add-bridge.ts --network amoy
	npx hardhat run ./scripts/bridge/add-bridge.ts --network holesky
	npx hardhat run ./scripts/bridge/add-bridge.ts --network sepolia
	npx hardhat run ./scripts/bridge/add-bridge.ts --network arbitrumSepolia


NETWORK=sepolia
#NETWORK=ava
#NETWORK=alfajores

add-bridge-tron:
	node ./scripts/tron/bridge/add-bridge.js --network nile

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

set-messenger-gas-usage:
	npx hardhat run ./scripts/messenger/set-gas-usage.ts --network $(NETWORK)

set-bridge-gas-usage:
	npx hardhat run ./scripts/bridge/set-gas-usage.ts --network $(NETWORK)

add-pool:
	npx hardhat run ./scripts/bridge/add-pool.ts --network $(NETWORK)

add-bridge:
	npx hardhat run ./scripts/bridge/add-bridge.ts --network $(NETWORK)

add-bridge-token:
	npx hardhat run ./scripts/bridge/add-bridge-token.ts --network $(NETWORK)


deploy-oft-proxy:
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

