import { Database } from "./database/database";
import { PricingService } from "./pricing/pricing";

export interface Architecture {
  paymentDatabase: Database;
  pricingService: PricingService;
}

export const defaultArch: Architecture = {
  paymentDatabase: {
    goodbyeUniverse() {
      return Promise.resolve({ address: "Steve", balance: 101 });
    },
  },
  pricingService: {
    helloWorld() {
      return Promise.resolve(777);
    },
  },
};

export default defaultArch;
