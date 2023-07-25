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
  const { pricingService, logger } = ctx.state;

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
    ctx.status = 200;
    ctx.set("Cache-Control", `max-age=${oneMinuteInSeconds}`);
    ctx.body = rates;
    logger.info("Successfully calculated rates.", { rates });
  } catch (error) {
    ctx.status = 502;
    ctx.body = "Failed to calculate rates.";
    logger.error("Failed to calculate rates.", error);
  }
  return next();
}

export async function fiatToArRateHandler(ctx: KoaContext, next: Next) {
  const { logger, pricingService } = ctx.state;
  const { currency } = ctx.params;

  logger.info("Fetching raw conversion rate for 1 AR", {
    currency,
  });
  if (!supportedPaymentCurrencyTypes.includes(currency)) {
    ctx.status = 404;
    ctx.body = "Invalid currency.";
    return next();
  }

  try {
    const fiatPriceForOneAR = await pricingService.getFiatPriceForOneAR(
      currency
    );
    logger.info("Successfully fetched raw fiat conversion rate for 1 AR", {
      currency,
      rate: fiatPriceForOneAR.toString(),
    });
    ctx.status = 200;
    ctx.body = {
      currency,
      rate: fiatPriceForOneAR.toString(),
    };
  } catch (error) {
    ctx.status = 502;
    ctx.body = "Failed to calculate raw fiat conversion for 1 AR.";
    logger.error("Failed to calculate raw fiat conversion for 1 AR.", error);
  }
  return next();
}
