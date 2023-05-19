set NODE_URL
set PRIVATE_KEY
set VALIDATOR_ADDRESS (both validator in one)
set COMMITMENT_LEVEL (for wormhole)
set CHAIN_ID

set WORMHOLE_CHAIN_ID https://book.wormhole.com/reference/contracts.html
set WORMHOLE_ADDRESS

npx hardhat run ./scripts/deploy/gas-oracle.ts --network mumbai
set GAS_ORACLE_ADDRESS
set otherChainIds in scripts/deploy/messenger.ts
npx hardhat run ./scripts/deploy/messenger.ts --network mumbai
set MESSENGER_ADDRESS

set otherChainIds in ./scripts/deploy/wormhole_messenger.ts
npx hardhat run ./scripts/deploy/wormhole_messenger.ts --network mumbai

npx hardhat run ./scripts/deploy/bridge.ts --network mumbai

set TOKEN_ADDRESS
set LP_TOKEN_NAME
set LP_TOKEN_SYMBOL

check args in ./scripts/deploy/pool.ts
npx hardhat run ./scripts/deploy/pool.ts --network mumbai

set POOL_ADDRESS


npx hardhat run ./scripts/bridge/add-liquidity.ts --network mumbai
npx hardhat run ./scripts/bridge/add-pool.ts --network mumbai


set args in ./scripts/bridge/add-bridge.ts
npx hardhat run ./scripts/bridge/add-bridge.ts --network goerli

set args in ./scripts/bridge/add-bridge-token.ts
npx hardhat run ./scripts/bridge/add-bridge-token.ts --network goerli

set args in ./scripts/bridge/set-gas-usage.ts
npx hardhat run ./scripts/bridge/set-gas-usage.ts --network goerli

set args in ./scripts/messenger/set-gas-usage.ts
npx hardhat run ./scripts/messenger/set-gas-usage.ts --network goerli

set args in ./scripts/wormhole/register-wormhole-messenger.ts  - chainId is Wormhole Chain ID from https://book.wormhole.com/reference/contracts.html, 
npx hardhat run ./scripts/wormhole/register-wormhole-messenger.ts --network goerli

set args in ./scripts/wormhole/set-gas-usage.ts
npx hardhat run ./scripts/wormhole/set-gas-usage.ts --network goerli


Tron:
remove all SafeERC20 methods and imports
remove all mapped name
change all pragma solidity to 0.8.11; 

tronbox compile

set NODE_URL
set PRIVATE_KEY
set VALIDATOR_ADDRESS (both validator in one)
set CHAIN_ID

tronbox migrate --f 1 --to 1 --network nile
set GAS_ORACLE_ADDRESS
set otherChainIds in migrations/2_deploy_messenger.js
tronbox migrate --f 2 --to 2 --network nile

tronbox migrate --f 3 --to 3 --network nile

set TOKEN_ADDRESS
set LP_TOKEN_NAME
set LP_TOKEN_SYMBOL

tronbox migrate --f 5 --to 5 --network nile


node ./scripts/tron/approve-token.js --network nile
node ./scripts/tron/add-pool-liquidity.js --network nile
node ./scripts/tron/add-pool.js --network nile

set args ./scripts/tron/add-bridge.js
node ./scripts/tron/add-bridge.js --network nile

set args ./scripts/tron/add-bridge-token.js
node ./scripts/tron/add-bridge-token.js --network nile

set args ./scripts/tron/set-bridge-gas-uasge.js
node ./scripts/tron/set-bridge-gas-uasge.js --network nile

set args ./scripts/tron/set-messenger-gas-uasge.js
node ./scripts/tron/set-messenger-gas-uasge.js --network nile
