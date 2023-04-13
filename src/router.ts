import { Next } from "koa";
import Router from "koa-router";
import * as promClient from "prom-client";

import logger from "./logger";
import { verifySignature } from "./middleware/verifySignature";
import { balanceRoute } from "./routes/balance";
import { priceQuote } from "./routes/priceQuote";
import { priceRoutes } from "./routes/priceRoutes";
import { refundBalance } from "./routes/refundBalance";
import { reserveBalance } from "./routes/reserveBalance";
import { stripeRoute } from "./routes/stripe/stripeRoute";
import { KoaContext } from "./server";

const metricsRegistry = promClient.register;
promClient.collectDefaultMetrics({ register: metricsRegistry });

const router = new Router();

router.get("/v1/price/:amount", priceRoutes);
router.get("/v1/price/bytes/:amount", priceRoutes);
router.get("/v1/price/:currency/:amount", priceRoutes);

router.get("/v1/price-quote/:currency/:amount", verifySignature, priceQuote);

router.post("/v1/balance/address", () => logger.info("TODO"));

router.post("/v1/webhook/stripe", () => logger.info("TODO"));

router.post("/v1/reserve-balance", () => logger.info("TODO"));
router.post("/v1/refund-balance", () => logger.info("TODO"));

router.post("/v1/stripe-webhook", stripeRoute);

router.get("/v1/balance", verifySignature, balanceRoute);

router.get(
  "/v1/reserve-balance/:walletAddress/:winstonCredits",
  reserveBalance
);

router.get("/v1/refund-balance/:walletAddress/:winstonCredits", refundBalance);

// Health
router.get("/health", async (ctx: KoaContext, next: Next) => {
  ctx.body = "OK";
  return next;
});

// Prometheus
router.get("/metrics", async (ctx: KoaContext, next: Next) => {
  ctx.body = await metricsRegistry.metrics();
  return next;
});

export default router;
