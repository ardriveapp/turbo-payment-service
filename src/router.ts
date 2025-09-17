/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc. All Rights Reserved.
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
import Router from "koa-router";
import * as promClient from "prom-client";

import { addressFromQuery, verifySignature } from "./middleware";
import { addPendingPaymentTx } from "./routes/addPendingPaymentTx";
import { arnsPurchaseQuote } from "./routes/arnsPurchaseQuote";
import { arweaveCompatiblePrice } from "./routes/arweaveCompatiblePrice";
import { balanceRoute } from "./routes/balance";
import { checkBalance } from "./routes/checkBalance";
import { countriesHandler } from "./routes/countries";
import { createApproval } from "./routes/createApproval";
import { currenciesRoute } from "./routes/currencies";
import { getAllApprovals } from "./routes/getAllApprovals";
import { getApprovals } from "./routes/getApprovals";
import { getArNSPurchaseStatus } from "./routes/getArNSPurchaseStatus";
import { rootResponse } from "./routes/info";
import { initiateArNSPurchase } from "./routes/initiateArNSPurchase";
import { priceArNSPurchaseHandler } from "./routes/priceArNSName";
import { priceRoutes } from "./routes/priceRoutes";
import { fiatToArRateHandler, ratesHandler } from "./routes/rates";
import { redeem } from "./routes/redeem";
import { refundBalance } from "./routes/refundBalance";
import { reserveBalance } from "./routes/reserveBalance";
import { revokeApprovals } from "./routes/revokeApprovals";
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
  "/v1/arns/price/:intent/:name",
  verifySignature,
  priceArNSPurchaseHandler
);

router.post(
  "/v1/arns/purchase/:intent/:name",
  verifySignature,
  initiateArNSPurchase
);

router.get("/v1/arns/purchase/:nonce", getArNSPurchaseStatus);

router.get(
  "/v1/top-up/:method/:address/:currency/:amount",
  verifySignature,
  topUp
);

router.get(
  "/v1/arns/quote/:method/:address/:currency/:intent/:name",
  arnsPurchaseQuote
);

router.get("/v1/redeem", redeem);

// TODO: Add API for admin routes that create and manage promotions

router.post("/v1/stripe-webhook", stripeRoute);
router.get("/v1/balance", verifySignature, balanceRoute);
router.get("/v1/currencies", currenciesRoute);
router.get("/v1/countries", countriesHandler);
router.get("/v1/rates", ratesHandler);
router.get("/v1/rates/:currency", fiatToArRateHandler);

router.get(["/info", "/v1/info", "/", "/v1"], rootResponse);

// routes for existing ecosystem compatibility
router.get("/account/balance/:token", (ctx) => {
  // on /account/*, we will temporarily stub balance requests
  ctx.body = "99999999999999999999999999999999999999";
  return;
});

router.get("/account/balance", (ctx) => {
  // on /account/*, we will temporarily stub balance requests
  ctx.body = "99999999999999999999999999999999999999";
  return;
});
router.post("/account/balance/:token", addPendingPaymentTx);

// Balance routes exposed at /v1 for stable API
router.get("/v1/account/balance/:token", addressFromQuery, balanceRoute);
router.get("/v1/account/balance", addressFromQuery, balanceRoute);
router.post("/v1/account/balance/:token", addPendingPaymentTx);

const backwardsCompatibleGetApprovalRoute = "/account/approval";
router.get(
  [backwardsCompatibleGetApprovalRoute, "/v1/account/approvals"],
  getApprovals
);
router.get("/v1/account/approvals/get", getAllApprovals);

// Protected routes
router.get("/v1/reserve-balance/:token/:signerAddress", reserveBalance);
router.get("/v1/refund-balance/:token/:signerAddress", refundBalance);
router.get("/v1/check-balance/:token/:signerAddress", checkBalance);
router.get("/v1/account/approvals/create", createApproval);
router.get("/v1/account/approvals/revoke", revokeApprovals);
// Health
router.get("/health", async (ctx: KoaContext) => {
  ctx.body = "OK";
  return;
});

// Prometheus
router.get("/metrics", async (ctx: KoaContext) => {
  ctx.body = await metricsRegistry.metrics();
  return;
});

// Swagger
router.get("/openapi.json", swaggerDocsJSON);
router.get("/api-docs", swaggerDocs);

// In order to integrate with existing ecosystem tools (e.g. Arconnect), we need to support the following route:
router.get("/price/:token/:amount", verifySignature, arweaveCompatiblePrice);
// This endpoint will return the price in winc, as a string, without any additional metadata.
// This is the same as the /v1/price/bytes/:amount endpoint, but without the metadata.

export default router;
