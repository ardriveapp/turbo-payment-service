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

    // Calculate fiat prices for one GiB with our fees applied
    await Promise.all(
      supportedPaymentCurrencyTypes.map(async (currency) => {
        const fiatPriceForOneAR = await pricingService.getFiatPriceForOneAR(
          currency
        );
        const fiatPriceForOneGiB: BigNumber = priceWithAdjustments.winc
          .toBigNumber()
          .times(fiatPriceForOneAR);

        const fiatValue: BigNumber =
          fiatPriceForOneGiB.dividedBy(oneARInWinston);

        const fiatValueAfterFees: BigNumber = fiatValue.multipliedBy(
          1 + turboFeePercentageAsADecimal
        );
        fiat[currency] = fiatValueAfterFees.toString();
      })
    );
    const rates = {
      winc: priceWithAdjustments.winc,
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
