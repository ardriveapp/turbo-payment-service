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
import cors from "@koa/cors";
import Koa, { DefaultState, Next, ParameterizedContext } from "koa";
import jwt from "koa-jwt";
import Stripe from "stripe";
import { Logger } from "winston";

import { Architecture } from "./architecture";
import {
  TEST_PRIVATE_ROUTE_SECRET,
  defaultPort,
  isGiftingEnabled,
  migrateOnStartup,
} from "./constants";
import { PostgresDatabase } from "./database/postgres";
import { MandrillEmailProvider } from "./emailProvider";
import {
  ArweaveGateway,
  EthereumGateway,
  GatewayMap,
  KyveGateway,
  SolanaGateway,
  MaticGateway
} from "./gateway";
import logger from "./logger";
import { MetricRegistry } from "./metricRegistry";
import { architectureMiddleware, loggerMiddleware } from "./middleware";
import { TurboPricingService } from "./pricing/pricing";
import router from "./router";
import { loadSecretsToEnv } from "./utils/loadSecretsToEnv";

type KoaState = DefaultState & Architecture & { logger: Logger };
export type KoaContext = ParameterizedContext<KoaState>;

logger.info(`Starting server with node environment ${process.env.NODE_ENV}...`);

process.on("uncaughtException", (error) => {
  MetricRegistry.uncaughtExceptionCounter.inc();
  logger.error("Uncaught exception:", error);
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, exiting...");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, exiting...");
  process.exit(0);
});

export async function createServer(
  arch: Partial<Architecture>,
  port: number = defaultPort
) {
  const app = new Koa();

  await loadSecretsToEnv();
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const MANDRILL_API_KEY = process.env.MANDRILL_API_KEY;
  const sharedSecret =
    process.env.PRIVATE_ROUTE_SECRET ?? TEST_PRIVATE_ROUTE_SECRET;

  if (!sharedSecret) {
    throw new Error("Shared secret not set");
  }
  if (!STRIPE_SECRET_KEY) {
    throw new Error("Stripe secret key or webhook secret not set");
  }

  app.use(loggerMiddleware);

  app.use(cors({ allowMethods: ["GET", "POST"] }));
  // NOTE: Middleware that use the JWT must handle ctx.state.user being undefined and throw
  // an error if the user is not authenticated
  app.use(jwt({ secret: sharedSecret, passthrough: true }));

  const pricingService = arch.pricingService ?? new TurboPricingService();
  const paymentDatabase =
    arch.paymentDatabase ?? new PostgresDatabase({ migrate: migrateOnStartup });
  const stripe =
    arch.stripe ?? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
  const gatewayMap: GatewayMap = arch.gatewayMap ?? {
    arweave: new ArweaveGateway(),
    ethereum: new EthereumGateway(),
    solana: new SolanaGateway(),
    kyve: new KyveGateway(),
    matic: new MaticGateway()
  };

  const emailProvider = (() => {
    if (!isGiftingEnabled) {
      return undefined;
    }
    if (arch.emailProvider) {
      return arch.emailProvider;
    }
    if (!MANDRILL_API_KEY) {
      throw new Error(
        "MANDRILL_API_KEY environment variable is not set! Please set the key and restart the server or set GIFTING_ENABLED=false to disable gifting by email on top ups flow."
      );
    }
    return new MandrillEmailProvider(MANDRILL_API_KEY, logger);
  })();
  app.use((ctx: KoaContext, next: Next) =>
    architectureMiddleware(ctx, next, {
      pricingService,
      paymentDatabase,
      stripe,
      emailProvider,
      gatewayMap,
    })
  );

  app.use(router.routes());

  const server = app.listen(port);
  server.keepAliveTimeout = 120_000; // intentionally longer than the ALB timeout
  server.requestTimeout = 120_000; // no requests should take longer than 2 minutes

  logger.info(`Listening on port ${port}...`);
  return server;
}
