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
    getARCForFiat() {
      return Promise.resolve(0);
    },
    getARCForBytes() {
      return Promise.resolve(0);
    },
  },
};

export default defaultArch;
