import cors from "@koa/cors";
import Koa, { DefaultState, ParameterizedContext } from "koa";

import { Architecture, getDefaultArch } from "./architecture";
import { defaultPort } from "./constants";
import logger from "./logger";
import { MetricRegistry } from "./metricRegistry";
import router from "./router";
import { loadSecretsToEnv } from "./utils/loadSecretsToEnv";

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

  await loadSecretsToEnv();
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

  if (!STRIPE_SECRET_KEY) {
    throw new Error("Stripe secret key or webhook secret not set");
  }

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
    const { paymentDatabase, pricingService, stripe } = arch;

    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

    if (!STRIPE_SECRET_KEY) {
      throw new Error("Stripe secret key or webhook secret not set");
    }
    const defaultArch = getDefaultArch();

    ctx.state.paymentDatabase = paymentDatabase ?? defaultArch.paymentDatabase;
    ctx.state.pricingService = pricingService ?? defaultArch.pricingService;
    ctx.state.stripe = stripe ?? defaultArch.stripe;
  }

  app.use(router.routes());

  const server = app.listen(port);

  logger.info(`Listening on port ${port}...`);
  return server;
}
