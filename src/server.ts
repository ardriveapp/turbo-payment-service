import cors from "@koa/cors";
import Koa, { DefaultState, ParameterizedContext } from "koa";

import defaultArch, { Architecture } from "./architecture";
import { defaultPort } from "./constants";
import logger from "./logger";
import { MetricRegistry } from "./metricRegistry";
import router from "./router";

type KoaState = DefaultState & Architecture;
export type KoaContext = ParameterizedContext<KoaState>;

logger.info(`Starting server with node environment ${process.env.NODE_ENV}...`);

process.on("uncaughtException", (error) => {
  MetricRegistry.uncaughtExceptionCounter.inc();
  logger.error("Uncaught exception:", error);
});

export async function createServer(
  arch: Partial<Architecture>,
  port: number = defaultPort
) {
  const app = new Koa();

  // TODO: Add Stripe Secrets to AWS turbo envs and re-enable secret manager. Ran into this error when logged into turbo dev:
  // error: Uncaught exception: getaddrinfo ENOTFOUND secretsmanager.region.amazonaws.com {"$metadata":{"attempts":1,"totalRetryDelay":0},"code":"ENOTFOUND","errno":-3008,"hostname":"secretsmanager.region.amazonaws.com","stack":"Error: getaddrinfo ENOTFOUND secretsmanager.region.amazonaws.com\n    at GetAddrInfoReqWrap.onlookup [as oncomplete] (node:dns:107:26)","syscall":"getaddrinfo"}
  // await loadSecretsToEnv();

  app.use(cors({ allowMethods: ["GET", "POST"] }));
  app.use(async (ctx: KoaContext, next) => {
    attachArchToKoaContext(ctx);

    try {
      await next();
    } catch (err) {
      logger.error(err);
    }
  });

  function attachArchToKoaContext(ctx: KoaContext): void {
    const { paymentDatabase, pricingService } = arch;

    ctx.state.paymentDatabase = paymentDatabase ?? defaultArch.paymentDatabase;
    ctx.state.pricingService = pricingService ?? defaultArch.pricingService;
  }

  app.use(router.routes());

  const server = app.listen(port);

  logger.info(`Listening on port ${port}...`);
  return server;
}
