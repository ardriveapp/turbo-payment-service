import { Next } from "koa";

import { KoaContext } from "../server";
import { supportedPaymentCurrencyTypes } from "../types/supportedCurrencies";

export async function currenciesRoute(ctx: KoaContext, next: Next) {
  const logger = ctx.state.logger;

  logger.info("Currencies requested");

  try {
    const limits = await ctx.state.pricingService.getCurrencyLimitations();

    ctx.body = {
      supportedCurrencies: supportedPaymentCurrencyTypes,
      limits,
    };
    ctx.status = 200;
  } catch (error) {
    ctx.body = "Fiat Oracle Unavailable";
    ctx.status = 502;
  }

  return next;
}
