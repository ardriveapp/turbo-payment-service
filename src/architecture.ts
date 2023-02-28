import { Database } from "./database/database";
import {
  CoingeckoArweaveToFiatOracle,
  ReadThroughArweaveToFiatOracle,
} from "./pricing/oracles/arweaveToFiatOracle";
import {
  ArweaveBytesToWinstonOracle,
  ReadThroughBytesToWinstonOracle,
} from "./pricing/oracles/bytesToWinstonOracle";
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
    arweaveToFiatOracle: new ReadThroughArweaveToFiatOracle({
      oracle: new CoingeckoArweaveToFiatOracle(),
    }),
  }),
};

export default defaultArch;
