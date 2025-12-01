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

## More Tests

### Foundry

In order to run the foundry tests, install Foundry:

[Installation](https://book.getfoundry.sh/getting-started/installation)

### Configure [Slither](https://github.com/crytic/slither)

1. `python3 -m venv venv`
2. `source ./venv/bin/activate`
3. `pip3 install slither-analyzer`

Run static analysis with

```
slither .
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
- Add pool to the bridge: `npx hardhat run ./scripts/bridge/add-pool.ts --network goerli`
- Set bridge (check args): `npx hardhat run ./scripts/bridge/add-bridge.ts --network goerli`
- Add bridge token (check args): `npx hardhat run ./scripts/bridge/add-bridge-token.ts --network goerli`
- Set bridge gas usage (check args): `npx hardhat run ./scripts/bridge/set-gas-usage.ts --network goerli`
- Set messenger gas usage (check args): `npx hardhat run ./scripts/messenger/set-gas-usage.ts --network goerli`
- Set wormhole gas usage (check args): `npx hardhat run ./scripts/wormhole/set-gas-usage.ts --network goerli`

### Tron (nile)

- Add to env file `NODE_URL`, `PRIVATE_KEY`, `VALIDATOR_ADDRESS`, `CHAIN_ID`

Deploy:

- Gas oracle: `tronbox migrate --f 1 --to 1 --network nile` set `GAS_ORACLE_ADDRESS`
- Messenger: `tronbox migrate --f 2 --to 2 --network nile` set `MESSENGER_ADDRESS`
- Bridge: `tronbox migrate --f 3 --to 3 --network nile` set `BRIDGE_ADDRESS`
- Optional deploy test token, check args inside : `tronbox migrate --f 4 --to 4 --network nile`
  set `TOKEN_ADDRESS`
- Pool: `tronbox migrate --f 5 --to 5 --network nile` set `POOL_ADDRESS`
- Auto Deposit Factory: `tronbox migrate --f 7 --to 7 --network nile` set `CHAIN_ID` & `GAS_ORACLE_ADDRESS`

Config:

- Approve token `node ./scripts/tron/approve-token.js --network nile`
- Add pool liquidity (check amount): `node ./scripts/tron/pool/add-pool-liquidity.js --network nile`
- Add pool to the bridge: `node ./scripts/tron/bridge/add-pool.js --network nile`
- Set bridge (check args): `node ./scripts/tron/bridge/add-bridge.js --network nile`
- Add bridge token (check args): `node ./scripts/tron/bridge/add-bridge-token.js --network nile`
- Set bridge gas usage (check args): `node ./scripts/tron/bridge/set-bridge-gas-usage.js --network nile`
- Set messenger gas usage (check args): `node ./scripts/tron/messenger/set-messenger-gas-usage.js --network nile`

### CCTP

Deploy:

- Add to env file `USDC_ADDRESS`, `CCTP_MESSENGER_ADDRESS`, `CCTP_TRANSMITTER_ADDRESS`
- CCTP Bridge `npx hardhat run scripts/deploy/cctp-bridge.ts --network goerli`

Config:

- Add to env file `CCTP_BRIDGE_ADDRESS`
- Register destination domains `npx hardhat run scripts/cctp-bridge/register-bridge-destination.ts --network goerli`
- Set bridge gas usage (check args): `npx hardhat run scripts/cctp-bridge/set-gas-usage.ts --network goerli`
- Add to env file `CCTP_FEE_BP`
- Set admin fee: `npx hardhat run scripts/cctp-bridge/set-admin-fee.ts --network goerli`

### Etherscan verification

- Add to env file `ETHERSCAN_API_KEY` and `<CONTRACT_ADDRESS>`
- Check `./scripts/verify/<contract>.ts` file args to be the same as on deploy
- Run `npx hardhat run ./scripts/verify/<contract>.ts --network goerli`
