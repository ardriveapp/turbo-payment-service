import * as promClient from "prom-client";

export class MetricRegistry {
  private static instance: MetricRegistry;
  private registry: promClient.Registry;
  public static paymentChargebackCounter = new promClient.Counter({
    name: "payment_intent_chargeback",
    help: "Count of successful payments fulfilled that were then disputed and/or charged back",
  });

  public static failedChargebackCounter = new promClient.Counter({
    name: "payment_intent_chargeback_failed",
    help: "Count of payment chargebacks that failed to properly handle a dispute",
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

  public registerMetric(metric: promClient.Metric<any>): void {
    this.registry.registerMetric(metric);
  }
}
