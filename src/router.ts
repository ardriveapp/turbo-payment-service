/**
 * Copyright (C) 2022-2023 Permanent Data Solutions, Inc. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
import { Next } from "koa";
import Router from "koa-router";
import * as promClient from "prom-client";

import { verifySignature } from "./middleware";
import { balanceRoute } from "./routes/balance";
import { countriesHandler } from "./routes/countries";
import { currenciesRoute } from "./routes/currencies";
import { priceRoutes } from "./routes/priceRoutes";
import { fiatToArRateHandler, ratesHandler } from "./routes/rates";
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
router.get("/v1/countries", countriesHandler);
router.get("/v1/rates", ratesHandler);
router.get("/v1/rates/:currency", fiatToArRateHandler);

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

// Health
router.get("/health", async (ctx: KoaContext, next: Next) => {
  ctx.body = "OK";
  return next();
});

// Prometheus
router.get("/metrics", async (ctx: KoaContext, next: Next) => {
  ctx.body = await metricsRegistry.metrics();
  return next();
});

router.get("/openapi.json", swaggerDocsJSON);
router.get("/api-docs", swaggerDocs);

export default router;
