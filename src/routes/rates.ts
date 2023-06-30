import { Next } from "koa";

import {
  oneARInWinston,
  oneGiBInBytes,
  oneMinuteInSeconds,
  turboFeePercentageAsADecimal,
} from "../constants";
import { KoaContext } from "../server";
import { supportedPaymentCurrencyTypes } from "../types/supportedCurrencies";
import { Winston } from "../types/types";

export async function ratesHandler(ctx: KoaContext, next: Next) {
  const logger = ctx.state.logger;
  const { pricingService } = ctx.state;

  try {
    const winston: Winston = await pricingService.getWCForBytes(oneGiBInBytes);
    const fiat: Record<string, number> = {};

    // Calculate fiat prices for one GiB
    await Promise.all(
      supportedPaymentCurrencyTypes.map(async (currency) => {
        const fiatPriceForOneAR = await pricingService.getFiatPriceForOneAR(
          currency
        );

        const fiatPriceForOneGiB = winston.times(fiatPriceForOneAR);
        const fiatValue =
          (fiatPriceForOneGiB.toBigNumber().toNumber() / oneARInWinston) *
          (1 + turboFeePercentageAsADecimal);

        fiat[currency] = fiatValue;
      })
    );

    const rates = {
      winc: winston.toBigNumber().toNumber(),
      fiat: { ...fiat },
    };
    ctx.response.status = 200;
    ctx.set("Cache-Control", `max-age=${oneMinuteInSeconds}`);
    ctx.body = rates;
    logger.info("Successfully calculated rates.", { rates });
  } catch (error) {
    ctx.response.status = 502;
    ctx.body = "Failed to calculate rates.";
    logger.error("Failed to calculate rates.", error);
  }
  return next;
}
