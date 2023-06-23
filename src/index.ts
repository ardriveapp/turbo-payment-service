import logger from "./logger";
import { createServer } from "./server";

// Here is our server 🙌
createServer({}).catch((e) => {
  logger.error(`Existing with error: ${e}`);
  process.exit(1);
});
