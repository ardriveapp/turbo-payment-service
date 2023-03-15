import { Database, TestDatabase } from "./database/database";
import { PricingService, TurboPricingService } from "./pricing/pricing";
import { SecretManager } from "./secretManager";

export interface Architecture {
  paymentDatabase: Database;
  pricingService: PricingService;
  secretManager: SecretManager;
}

export const defaultArch: Architecture = {
  paymentDatabase: new TestDatabase(),
  pricingService: new TurboPricingService({}),
  secretManager: new SecretManager(),
};

export default defaultArch;
