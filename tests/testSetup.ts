import { config } from "dotenv";
import { restore } from "sinon";

// load local env vars before starting the service
config();
process.env.NODE_ENV ??= "test";

// Restores the default sandbox after every test
exports.mochaHooks = {
  afterEach() {
    restore();
  },
};
