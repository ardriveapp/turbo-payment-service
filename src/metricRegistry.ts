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
import * as promClient from "prom-client";

export class MetricRegistry {
  private static instance: MetricRegistry;
  private registry: promClient.Registry;
  public static paymentChargebackCounter = new promClient.Counter({
    name: "payment_intent_chargeback",
    help: "Count of successful payments fulfilled that were then disputed and/or charged back and successfully processed",
  });

  public static failedChargebackCounter = new promClient.Counter({
    name: "payment_intent_chargeback_failed",
    help: "Count of successful payments fulfilled that were then disputed and/or charged back and failed to process",
  });

  public static paymentRefundedCounter = new promClient.Counter({
    name: "payment_intent_refunded",
    help: "Count of payment success events received that were immediately rejected at a database level and refunded",
  });

  public static topUpsCounter = new promClient.Counter({
    name: "top_ups",
    help: "top_ups",
  });

  public static paymentSuccessCounter = new promClient.Counter({
    name: "payment_intent_succeeded",
    help: "payment_intent_succeeded",
  });

  public static stripeSessionCreationErrorCounter = new promClient.Counter({
    name: "stripe_session_creation_error",
    help: "stripe_session_creation_error",
  });

  public static uncaughtExceptionCounter = new promClient.Counter({
    name: "uncaught_exceptions_total",
    help: "Count of uncaught exceptions",
  });

  // TODO: add metric that tracks fraudulent wallet addresses
  public static suspiciousWalletActivity = new promClient.Counter({
    name: "suspicious_wallet_activity",
    help: "Count of suspicious wallet activity (e.g. high number of chargebacks)",
  });

  private constructor() {
    this.registry = new promClient.Registry();

    this.registry.registerMetric(MetricRegistry.paymentChargebackCounter);
    this.registry.registerMetric(MetricRegistry.failedChargebackCounter);
    this.registry.registerMetric(MetricRegistry.paymentRefundedCounter);
    this.registry.registerMetric(MetricRegistry.paymentSuccessCounter);
    this.registry.registerMetric(MetricRegistry.topUpsCounter);
    this.registry.registerMetric(MetricRegistry.uncaughtExceptionCounter);
    this.registry.registerMetric(
      MetricRegistry.stripeSessionCreationErrorCounter
    );
    this.registry.registerMetric(MetricRegistry.suspiciousWalletActivity);
  }

  public static getInstance(): MetricRegistry {
    if (!MetricRegistry.instance) {
      MetricRegistry.instance = new MetricRegistry();
    }

    return MetricRegistry.instance;
  }

  public getRegistry(): promClient.Registry {
    return this.registry;
  }

  public registerMetric(metric: promClient.Metric): void {
    this.registry.registerMetric(metric);
  }
}
