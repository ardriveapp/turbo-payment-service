import { Database, TestDatabase } from "./database/database";
import { PricingService, TurboPricingService } from "./pricing/pricing";

export interface Architecture {
  paymentDatabase: Database;
  pricingService: PricingService;
}

export const defaultArch: Architecture = {
  paymentDatabase: new TestDatabase(),
  pricingService: new TurboPricingService({}),
};

export default defaultArch;
