import Stripe from "stripe";

import { Database } from "./database/database";
import { PostgresDatabase } from "./database/postgres";
import { PricingService, TurboPricingService } from "./pricing/pricing";

export interface Architecture {
  paymentDatabase: Database;
  pricingService: PricingService;
  stripe: Stripe;
}
export function getDefaultArch(): Architecture {
  console.log(process.env.STRIPE_SECRET_KEY!.split("_")[0]);
  return {
    paymentDatabase: new PostgresDatabase(),
    pricingService: new TurboPricingService({}),
    stripe: new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2022-11-15",
      appInfo: {
        // For sample support and debugging, not required for production:
        name: "ardrive-turbo",
        version: "0.0.0",
      },
      typescript: true,
    }),
  };
}
