import { Database, TestDatabase } from "./database/database";
import { MetricRegistry } from "./metricRegistry";
import { PricingService, TurboPricingService } from "./pricing/pricing";

export interface Architecture {
  paymentDatabase: Database;
  pricingService: PricingService;
  metricsRegistry?: MetricRegistry;
}

export const defaultArch: Architecture = {
  paymentDatabase: new TestDatabase(),
  pricingService: new TurboPricingService({}),
  metricsRegistry: MetricRegistry.getInstance(),
};

export default defaultArch;
