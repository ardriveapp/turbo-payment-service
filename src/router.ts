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
import { arweaveCompatiblePrice } from "./routes/arweaveCompatiblePrice";
import { balanceRoute } from "./routes/balance";
import { checkBalance } from "./routes/checkBalance";
import { countriesHandler } from "./routes/countries";
import { currenciesRoute } from "./routes/currencies";
import { priceRoutes } from "./routes/priceRoutes";
import { fiatToArRateHandler, ratesHandler } from "./routes/rates";
import { redeem } from "./routes/redeem";
import { refundBalance } from "./routes/refundBalance";
import { reserveBalance } from "./routes/reserveBalance";
import { stripeRoute } from "./routes/stripe/stripeRoute";
import { swaggerDocs, swaggerDocsJSON } from "./routes/swagger";
import { topUp } from "./routes/topUp";
import { KoaContext } from "./server";

const metricsRegistry = promClient.register;
promClient.collectDefaultMetrics({ register: metricsRegistry });

const router = new Router();

/**
 * Note: when we return next(); in our handlers we are telling koa to continue to the next route handler. if any routes having matching paths, then BOTH handlers will be called, which may not be desired.
 */

// TODO: these can be broken out into separate handlers
router.get("/v1/price/:amount", verifySignature, priceRoutes);
// also handles /v1/price/bytes/:amount
router.get("/v1/price/:currency/:amount", verifySignature, priceRoutes);

router.get(
  "/v1/top-up/:method/:address/:currency/:amount",
  verifySignature,
  topUp
);

router.get("/v1/redeem", redeem);

// TODO: Add API for admin routes that create and manage promotions

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

router.get("/v1/check-balance/:walletAddress", checkBalance);

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

// In order to integrate with existing ecosystem tools (e.g. Arconnect), we need to support the following route:
router.get("/price/arweave/:amount", verifySignature, arweaveCompatiblePrice);
// This endpoint will return the price in winc, as a string, without any additional metadata.
// This is the same as the /v1/price/bytes/:amount endpoint, but without the metadata.

export default router;
