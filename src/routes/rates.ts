import { Next } from "koa";

import { oneGiBInBytes, oneMinuteInSeconds } from "../constants";
import { KoaContext } from "../server";
import { supportedPaymentCurrencyTypes } from "../types/supportedCurrencies";
import { Winston } from "../types/types";

export async function ratesHandler(ctx: KoaContext, next: Next) {
  const logger = ctx.state.logger;
  const { pricingService } = ctx.state;

  logger.info("GET request for rates");

  try {
    const credits: Winston = await pricingService.getWCForBytes(oneGiBInBytes);
    // 80% of the credits to account for the 20% turbo fee
    const winston: Winston = credits.times(0.8);
    const fiat = {} as Record<string, number>;

    for (const currency in supportedPaymentCurrencyTypes) {
      const fiatPrice = await pricingService.getFiatPriceForOneAR(currency);
      fiat[currency] = winston.times(fiatPrice).toBigNumber().toNumber();
    }
    const creditsAsNumber = credits.toBigNumber().toNumber();
    const winstonAsNumber = winston.toBigNumber().toNumber();
    const rates = {
      credits: creditsAsNumber,
      winston: winstonAsNumber,
      fiat: { ...fiat },
    };
    ctx.response.status = 200;
    ctx.set("Cache-Control", `max-age=${oneMinuteInSeconds}`);
    ctx.body = {
      rates,
    };
    logger.info("Rates calculated!", { rates });
  } catch (error) {
    ctx.response.status = 502;
    ctx.body = "Cannot calculate rates";
    logger.error("Cannot calculate rates", { error });
  }
  return next;
}
