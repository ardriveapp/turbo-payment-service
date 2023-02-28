import { Database } from "./database/database";
import {
  ArweaveBytesToWinstonOracle,
  ReadThroughBytesToWinstonOracle,
} from "./pricing/oracles/BytesToWinstonOracle";
import {
  CoingeckoArweaveToFiatOracle,
  ReadThroughFiatToArOracle,
} from "./pricing/oracles/arweaveToFiatOracle";
import { PricingService, TurboPricingService } from "./pricing/pricing";

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
  pricingService: new TurboPricingService({
    BytesToWinstonOracle: new ReadThroughBytesToWinstonOracle({
      oracle: new ArweaveBytesToWinstonOracle(),
    }),
    arweaveToFiatOracle: new ReadThroughFiatToArOracle({
      oracle: new CoingeckoArweaveToFiatOracle(),
    }),
  }),
};

export default defaultArch;
