import { Next } from "koa";
import Router from "koa-router";
import * as promClient from "prom-client";

import { verifySignature } from "./middleware";
import { balanceRoute } from "./routes/balance";
import { countriesHandler } from "./routes/countries";
import { currenciesRoute } from "./routes/currencies";
import { priceRoutes } from "./routes/priceRoutes";
import { ratesHandler } from "./routes/rates";
import { refundBalance } from "./routes/refundBalance";
import { reserveBalance } from "./routes/reserveBalance";
import { stripeRoute } from "./routes/stripe/stripeRoute";
import { swaggerDocs, swaggerDocsJSON } from "./routes/swagger";
import { topUp } from "./routes/topUp";
import { KoaContext } from "./server";

const metricsRegistry = promClient.register;
promClient.collectDefaultMetrics({ register: metricsRegistry });

const router = new Router();

router.get("/v1/price/:amount", verifySignature, priceRoutes);
router.get("/v1/price/bytes/:amount", verifySignature, priceRoutes);
router.get("/v1/price/:currency/:amount", verifySignature, priceRoutes);

router.get("/v1/top-up/:method/:address/:currency/:amount", topUp);

router.post("/v1/stripe-webhook", stripeRoute);

router.get("/v1/balance", verifySignature, balanceRoute);

router.get("/v1/currencies", currenciesRoute);

// temporary route for backwards compatibility
router.get(
  "/v1/reserve-balance/:walletAddress/:byteCount",
  (ctx: KoaContext, next: Next) => {
    const { byteCount } = ctx.params;
    ctx.query.byteCount = byteCount;
    return reserveBalance(ctx, next);
  }
);

router.get("/v1/reserve-balance/:walletAddress", reserveBalance);

// temporary route for backwards compatibility
router.get(
  "/v1/refund-balance/:walletAddress/:winstonCredits",
  (ctx: KoaContext, next: Next) => {
    const { winstonCredits } = ctx.params;
    ctx.query.winstonCredits = winstonCredits;
    return refundBalance(ctx, next);
  }
);

router.get("/v1/refund-balance/:walletAddress", refundBalance);

router.get("/v1/countries", countriesHandler);

router.get("/v1/rates", ratesHandler);

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

router.get("/openapi.json", swaggerDocsJSON);
router.get("/api-docs", swaggerDocs);

export default router;
