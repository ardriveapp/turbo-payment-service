import { Next } from "koa";
import Router from "koa-router";
import * as promClient from "prom-client";

import { verifySignature } from "./middleware/verifySignature";
import { balanceRoute } from "./routes/balance";
import { priceRoutes } from "./routes/priceRoutes";
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

router.get("/v1/reserve-balance/:walletAddress/:byteCount", reserveBalance);

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

router.get("/openapi.json", swaggerDocsJSON);
router.get("/api-docs", swaggerDocs);

export default router;
