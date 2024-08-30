"use-strict";

process.env.CRYPTO_FUND_EXCLUDED_ADDRESSES = "testExcludedAddress";

// Mocha configuration file
// Reference for options: https://github.com/mochajs/mocha/blob/master/example/config/.mocharc.js
module.exports = {
  extension: ["ts"],
  require: ["ts-node/register/transpile-only", "tests/testSetup.ts"],
  timeout: "7000",
  parallel: true,
  recursive: true,
};
