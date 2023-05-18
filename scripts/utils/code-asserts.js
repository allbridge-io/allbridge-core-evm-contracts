const fs = require('fs');
const path = require('path');

function assertDoesNotContainSafeERC20(source) {
  if (containsSafeERC20(source)) {
    throw new Error('Unexpected use of SafeERC20');
  }
}

function assertContainsSafeERC20(source) {
  if (!containsSafeERC20(source)) {
    throw new Error('Not found SafeERC20');
  }
}

function loadSolSource(contractName) {
  const sourcePath = path.join(
    __dirname,
    '../../contracts',
    contractName + '.sol',
  );

  return fs.readFileSync(sourcePath).toString();
}

function containsSafeERC20(source) {
  return /SafeERC20|safeTransfer/gi.test(source);
}

module.exports = {
  assertDoesNotContainSafeERC20,
  assertContainsSafeERC20,
  loadSolSource,
};
