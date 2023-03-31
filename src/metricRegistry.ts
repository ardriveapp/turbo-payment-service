import * as promClient from "prom-client";

export class MetricRegistry {
  private static instance: MetricRegistry;
  private registry: promClient.Registry;
  public static paymentFailedCounter = new promClient.Counter({
    name: "payment_intent_failed",
    help: "payment_intent_failed",
  });

  public static topUpsCounter = new promClient.Counter({
    name: "top_ups",
    help: "top_ups",
  });

  public static paymentSuccessCounter = new promClient.Counter({
    name: "payment_intent_succeeded",
    help: "payment_intent_succeeded",
  });

  public static uncaughtExceptionCounter = new promClient.Counter({
    name: "uncaught_exceptions_total",
    help: "Count of uncaught exceptions",
  });

  private constructor() {
    this.registry = new promClient.Registry();
    this.registry.registerMetric(MetricRegistry.paymentFailedCounter);
    this.registry.registerMetric(MetricRegistry.paymentSuccessCounter);
    this.registry.registerMetric(MetricRegistry.topUpsCounter);
    this.registry.registerMetric(MetricRegistry.uncaughtExceptionCounter);
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
