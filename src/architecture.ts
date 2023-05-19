import Stripe from "stripe";

import { Database } from "./database/database";
import { PricingService } from "./pricing/pricing";

export interface Architecture {
  paymentDatabase: Database;
  pricingService: PricingService;
  stripe: Stripe;
}
