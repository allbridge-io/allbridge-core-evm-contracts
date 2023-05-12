# Allbridge Core EVM Contracts

This repo contains the most recent EVM and Tron version of Allbridge Core smart contracts.

## Requirements

- `npm` or `pnpm` to install all dependencies and Hardhat

## Getting started

```
npm install
npm run test
npm run test-fuzzy
```

## Deploy

### EVM (goerli)

- Add to env file `NODE_URL`, `PRIVATE_KEY`, `VALIDATOR_ADDRESS`, `CHAIN_ID`, `WORMHOLE_CHAIN_ID`, `WORMHOLE_ADDRESS`

Deploy:

- `npx hardhat run ./scripts/deploy/gas-oracle.ts --network goerli` set `GAS_ORACLE_ADDRESS`
- `npx hardhat run ./scripts/deploy/messenger.ts --network goerli` set `MESSENGER_ADDRESS`
- `npx hardhat run ./scripts/deploy/wormhole_messenger.ts --network goerli` set `WORMHOLE_MESSENGER_ADDRESS`
- `npx hardhat run ./scripts/deploy/bridge.ts --network goerli` set `BRIDGE_ADDRESS`
- Optional deploy test token, check args inside : `npx hardhat run ./scripts/deploy/test-token.ts --network goerli`
  set `TOKEN_ADDRESS`
- `npx hardhat run ./scripts/deploy/pool.ts --network goerli` set `POOL_ADDRESS`

Config:

- Add pool liquidity: `npx hardhat run ./scripts/bridge/add-liquidity.ts --network goerli`
- Add pool to the bridge:  `npx hardhat run ./scripts/bridge/add-pool.ts --network goerli`
- Set bridge (check args): `npx hardhat run ./scripts/bridge/add-bridge.ts --network goerli`
- Add bridge token (check args): `npx hardhat run ./scripts/bridge/add-bridge-token.ts --network goerli`
- Set bridge gas usage (check args): `npx hardhat run ./scripts/bridge/set-gas-usage.ts --network goerli`
- Set messenger gas usage (check args): `npx hardhat run ./scripts/messenger/set-gas-usage.ts --network goerli`
- Set wormhole gas usage (check args): `npx hardhat run ./scripts/wormhole/set-gas-usage.ts --network goerli`

### Tron (shasta)

- Add to env file `NODE_URL`, `PRIVATE_KEY`, `VALIDATOR_ADDRESS`, `CHAIN_ID`

Deploy:

- Gas oracle: `tronbox migrate --f 1 --to 1 --network shasta` set `GAS_ORACLE_ADDRESS`
- Messenger: `tronbox migrate --f 2 --to 2 --network shasta` set `MESSENGER_ADDRESS`
- Bridge: `tronbox migrate --f 3 --to 3 --network shasta` set `BRIDGE_ADDRESS`
- Optional deploy test token, check args inside : `tronbox migrate --f 4 --to 4 --network shasta`
  set `TOKEN_ADDRESS`
- Pool: `tronbox migrate --f 5 --to 5 --network shasta` set `POOL_ADDRESS`

Config:

- Approve token `node ./scripts/tron/approve-token.js --network shasta`
- Add pool liquidity (check amount): `node ./scripts/tron/add-pool-liquidity.js --network shasta`
- Add pool to the bridge: `node ./scripts/tron/add-pool.js --network shasta`
- Set bridge (check args): `node ./scripts/tron/add-bridge.js --network shasta`
- Add bridge token (check args): `node ./scripts/tron/add-bridge-token.js --network shasta`
- Set bridge gas usage (check args): `node ./scripts/tron/set-bridge-gas-uasge.js --network shasta`
- Set messenger gas usage (check args): `node ./scripts/tron/set-messenger-gas-uasge.js --network shasta`
