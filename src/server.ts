import cors from "@koa/cors";
import Koa, { DefaultState, ParameterizedContext } from "koa";
import jwt from "koa-jwt";
import Stripe from "stripe";

import { Architecture } from "./architecture";
import { TEST_PRIVATE_ROUTE_SECRET, defaultPort } from "./constants";
import { PostgresDatabase } from "./database/postgres";
import logger from "./logger";
import { MetricRegistry } from "./metricRegistry";
import { TurboPricingService } from "./pricing/pricing";
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
  const sharedSecret =
    process.env.PRIVATE_ROUTE_SECRET ?? TEST_PRIVATE_ROUTE_SECRET;

  if (!sharedSecret) {
    throw new Error("Shared secret not set");
  }

  if (!STRIPE_SECRET_KEY) {
    throw new Error("Stripe secret key or webhook secret not set");
  }

  app.use(cors({ allowMethods: ["GET", "POST"] }));
  // NOTE: Middleware that use the JWT must handle ctx.state.user being undefined and throw
  // an error if the user is not authenticated
  app.use(jwt({ secret: sharedSecret, passthrough: true }));

  const pricingService = arch.pricingService ?? new TurboPricingService({});
  const paymentDatabase = arch.paymentDatabase ?? new PostgresDatabase();
  const stripe =
    arch.stripe ?? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2022-11-15" });

  function attachArchToKoaContext(ctx: KoaContext): void {
    ctx.state.paymentDatabase = paymentDatabase;
    ctx.state.pricingService = pricingService;
    ctx.state.stripe = stripe;
  }

  app.use(async (ctx: KoaContext, next) => {
    attachArchToKoaContext(ctx);

    try {
      await next();
    } catch (err) {
      logger.error(err);
    }
  });

  app.use(router.routes());

  const server = app.listen(port);

  logger.info(`Listening on port ${port}...`);
  return server;
}
