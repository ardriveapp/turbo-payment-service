import { restore } from "sinon";

process.env.NODE_ENV = "test";
process.env.PORT ??= "1234";
process.env.DISABLE_LOGS ??= "true";

// Restores the default sandbox after every test
exports.mochaHooks = {
  afterEach() {
    restore();
  },
};
