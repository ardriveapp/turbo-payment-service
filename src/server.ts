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

export function createServer(
  arch: Partial<Architecture>,
  port: number = defaultPort
) {
  const app = new Koa();

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
    const { paymentDatabase, pricingService, metricsRegistry } = arch;

    ctx.state.paymentDatabase = paymentDatabase ?? defaultArch.paymentDatabase;
    ctx.state.pricingService = pricingService ?? defaultArch.pricingService;
    ctx.state.metricsRegistry = metricsRegistry ?? defaultArch.metricsRegistry;
  }

  app.use(router.routes());

  const server = app.listen(port);

  logger.info(`Listening on port ${port}...`);
  return server;
}
