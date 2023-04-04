import { Database } from "./database/database";
import { PostgresDatabase } from "./database/postgres";
import { PricingService, TurboPricingService } from "./pricing/pricing";

export interface Architecture {
  paymentDatabase: Database;
  pricingService: PricingService;
}

export const defaultArch: Architecture = {
  paymentDatabase: new PostgresDatabase(),
  pricingService: new TurboPricingService({}),
};

export default defaultArch;
