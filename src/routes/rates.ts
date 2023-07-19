import { Next } from "koa";

import {
  oneARInWinston,
  oneGiBInBytes,
  oneMinuteInSeconds,
  turboFeePercentageAsADecimal,
} from "../constants";
import { KoaContext } from "../server";
import { supportedPaymentCurrencyTypes } from "../types/supportedCurrencies";

export async function ratesHandler(ctx: KoaContext, next: Next) {
  const logger = ctx.state.logger;
  const { pricingService } = ctx.state;

  try {
    // TODO: applying adjustments on the generic /rates endpoint might not be the best idea, we may want to just show the raw rates for 1 GiB unadjusted, then return
    // 'availableAdjustments' or similar and have the client show how they can be used/applied to the raw rate
    const priceWithAdjustments = await pricingService.getWCForBytes(
      oneGiBInBytes
    );
    const fiat: Record<string, number> = {};

    // Calculate fiat prices for one GiB
    await Promise.all(
      supportedPaymentCurrencyTypes.map(async (currency) => {
        const fiatPriceForOneAR = await pricingService.getFiatPriceForOneAR(
          currency
        );

        const fiatPriceForOneGiB =
          priceWithAdjustments.winc.times(fiatPriceForOneAR);
        const fiatValue =
          // TODO: `toNumber()` on this is tech debt. We could lose precision in the future if this value is higher than MAX_SAFE_INT
          (fiatPriceForOneGiB.toBigNumber().toNumber() / oneARInWinston) *
          (1 + turboFeePercentageAsADecimal);

        fiat[currency] = fiatValue;
      })
    );
    const rates = {
      winc: priceWithAdjustments.winc.toString(),
      fiat,
      adjustments: priceWithAdjustments.adjustments,
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
  return next();
}
