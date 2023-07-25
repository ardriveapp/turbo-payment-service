import BigNumber from "bignumber.js";
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
    const fiat: Record<string, BigNumber.Value> = {};

    // Calculate fiat prices for one GiB
    await Promise.all(
      supportedPaymentCurrencyTypes.map(async (currency) => {
        // Get fiat price for one AR
        const fiatPriceForOneAR = await pricingService.getFiatPriceForOneAR(
          currency
        );
        // get the amount of AR required to purchase 1 GiB
        const winstonPriceForOneGiBInAR =
          priceWithAdjustments.winc.times(fiatPriceForOneAR);

        // divide the AR price by the number of winston in AR, and add turbo fee
        const fiatPriceForOneGiBofArAfterFees = winstonPriceForOneGiBInAR
          .dividedBy(oneARInWinston)
          .times(1 + turboFeePercentageAsADecimal);

        fiat[currency] = fiatPriceForOneGiBofArAfterFees.toString();
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
