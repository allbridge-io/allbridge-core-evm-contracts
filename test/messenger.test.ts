import { expect } from 'chai';
import { ethers, waffle } from 'hardhat';

import { Messenger } from '../typechain';
import { abi as GasOracleABI } from '../artifacts/contracts/GasOracle.sol/GasOracle.json';
import { encodeMessage, signMessage, receiveParams } from './utils';
import { MockContract } from 'ethereum-waffle';

const { deployMockContract, provider } = waffle;

describe('Messenger', () => {
  const chainId = 3;
  const brokenValidatorPK =
    '0x0000000000000000000000000000000000000000000000000000000000000000';

  let primaryValidatorPK: string;
  let secondaryValidatorPK: string;

  let primaryValidatorAddress: string;
  let secondaryValidatorAddress: string;

  let messenger: Messenger;
  let mockedGasOracle: MockContract;

  beforeEach(async function () {
    const [
      deployerOfContract,
      primaryValidatorAccount,
      secondaryValidatorAccount,
    ] = provider.getWallets();

    primaryValidatorPK = primaryValidatorAccount.privateKey;
    secondaryValidatorPK = secondaryValidatorAccount.privateKey;

    primaryValidatorAddress = primaryValidatorAccount.address;
    secondaryValidatorAddress = secondaryValidatorAccount.address;

    // @ts-ignore
    mockedGasOracle = await deployMockContract(
      deployerOfContract,
      GasOracleABI,
    );

    const messengerContract = (await ethers.getContractFactory(
      'Messenger',
    )) as any;
    messenger = await messengerContract.deploy(
      chainId,
      '0x0101010000000000000000000000000000000000000000000000000000000000',
      mockedGasOracle.address,
      primaryValidatorAccount.address,
      [secondaryValidatorAccount.address],
    );
  });

  it('Success: Send message', async () => {
    const message = encodeMessage({
      sourceChainId: chainId,
      message: 'Test message',
    });

    await mockedGasOracle.mock.getTransactionGasCostInNativeToken.returns(
      0
    );
    const response = await messenger.sendMessage(message);

    expect(response).emit(messenger, 'MessageSent').withArgs(message);
  });

  it('Failure: Send message to unsupported chain', async () => {
    const message = encodeMessage({
      sourceChainId: chainId,
      destinationChainId: 4,
      message: 'Test message',
    });

    await expect(messenger.sendMessage(message, { value: 8 })).revertedWith(
      'Messenger: wrong destination',
    );
  });

  it('Failure: Send message with insufficient tx value', async () => {
    const message = encodeMessage({
      sourceChainId: chainId,
      message: 'Test message',
    });

    await messenger.setGasUsage(0, 10);
    await mockedGasOracle.mock.getTransactionGasCostInNativeToken.returns(10);

    await expect(messenger.sendMessage(message, { value: 8 })).revertedWith(
      'Messenger: not enough fee',
    );
  });

  it('Failure: Send message with wrong chain id', async () => {
    const message = encodeMessage({
      sourceChainId: 2,
      message: 'Test message',
    });

    await expect(messenger.sendMessage(message)).revertedWith(
      'Messenger: wrong chainId',
    );
  });

  it('Failure: Send message twice', async () => {
    const message = encodeMessage({
      sourceChainId: chainId,
      message: 'Test message',
    });

    await mockedGasOracle.mock.getTransactionGasCostInNativeToken.returns(
      0
    );
    await messenger.sendMessage(message);
    await expect(messenger.sendMessage(message)).revertedWith(
      'Messenger: has message',
    );
  });

  it('Success: Confirm message', async () => {
    const message = encodeMessage({
      destinationChainId: chainId,
      message: 'Test message',
    });

    const primarySignature = await signMessage(primaryValidatorPK, message);
    const secondarySignature = await signMessage(secondaryValidatorPK, message);

    const response = messenger.receiveMessage(
      message,
      ...receiveParams(primarySignature, secondarySignature),
    );
    expect(response).emit(messenger, 'MessageConfirmed').withArgs(message);
    const hasMessage = (await messenger.receivedMessages(message)).gt(0);
    expect(hasMessage).equal(true);
  });

  it('Failure: Confirm message with wrong chain id', async () => {
    const message = encodeMessage({
      destinationChainId: 2,
      message: 'Test message',
    });
    await expect(messenger.sendMessage(message)).revertedWith(
      'Messenger: wrong chainId',
    );
  });

  it('Failure: Confirm message with broken validator', async () => {
    const message = encodeMessage({
      destinationChainId: chainId,
      message: 'Test message',
    });

    const primarySignature = await signMessage(brokenValidatorPK, message);
    const secondarySignature = await signMessage(secondaryValidatorPK, message);

    await expect(
      messenger.receiveMessage(
        message,
        ...receiveParams(primarySignature, secondarySignature),
      ),
    ).revertedWith('Messenger: invalid primary');
  });

  it('Failure: Confirm message with broken secondary validator', async () => {
    const message = encodeMessage({
      destinationChainId: chainId,
      message: 'Test message',
    });

    const primarySignature = await signMessage(primaryValidatorPK, message);
    const secondarySignature = await signMessage(brokenValidatorPK, message);

    await expect(
      messenger.receiveMessage(
        message,
        ...receiveParams(primarySignature, secondarySignature),
      ),
    ).revertedWith('Messenger: invalid secondary');
  });

  it('Success: Confirm message twice', async () => {
    const message = encodeMessage({
      destinationChainId: chainId,
      message: 'Test message',
    });

    const primarySignature = await signMessage(primaryValidatorPK, message);
    const secondarySignature = await signMessage(secondaryValidatorPK, message);

    await messenger.receiveMessage(
      message,
      ...receiveParams(primarySignature, secondarySignature),
    );
    // There is no problem if message is confirmed twice
    await messenger.receiveMessage(
      message,
      ...receiveParams(primarySignature, secondarySignature),
    );
  });

  it('Success: Update validators', async () => {
    await messenger.setSecondaryValidators(
      [secondaryValidatorAddress],
      [primaryValidatorAddress],
    );
  });
});
