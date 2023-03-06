import { Next } from "koa";
import Router from "koa-router";
import * as promClient from "prom-client";

import logger from "./logger";
import { helloWorldRoute } from "./routes/helloWorld";
import { priceRoute } from "./routes/price";
import { priceBytes } from "./routes/priceBytes";
import { KoaContext } from "./server";

const metricsRegistry = promClient.register;
promClient.collectDefaultMetrics({ register: metricsRegistry });

const router = new Router();

router.get("/", helloWorldRoute);
router.post("/price/:currency/:value", priceRoute);
router.post("/v1/price/:currency/:value", priceBytes);

router.post("/price/bytes/:value", priceBytes);
router.post("/v1/price/bytes/:value", priceBytes);

router.post("/v1/price-quote", () => logger.info("TODO"));

router.post("/v1/balance/address", () => logger.info("TODO"));

router.post("/v1/webhook/stripe", () => logger.info("TODO"));

router.post("/v1/reserve-balance", () => logger.info("TODO"));
router.post("/v1/refund-balance", () => logger.info("TODO"));

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
