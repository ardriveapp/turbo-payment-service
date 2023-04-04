import cors from "@koa/cors";
import Koa, { DefaultState, ParameterizedContext } from "koa";
import Stripe from "stripe";

import defaultArch, { Architecture } from "./architecture";
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

  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2022-11-15",
    appInfo: {
      // For sample support and debugging, not required for production:
      name: "ardrive-turbo",
      version: "0.0.0",
    },
    typescript: true,
  });

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
    ctx.state.stripeInstance = stripe;
  }

  app.use(router.routes());

  const server = app.listen(port);

  logger.info(`Listening on port ${port}...`);
  return server;
}
