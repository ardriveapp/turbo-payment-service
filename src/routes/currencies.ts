import { Next } from "koa";

import { ExposedCurrencyLimitations } from "../constants";
import { KoaContext } from "../server";
import {
  SupportedPaymentCurrencyTypes,
  supportedPaymentCurrencyTypes,
  zeroDecimalCurrencyTypes,
} from "../types/supportedCurrencies";

export async function currenciesRoute(ctx: KoaContext, next: Next) {
  const logger = ctx.state.logger;

  logger.info("Currencies requested");

  try {
    const limits = await ctx.state.pricingService.getCurrencyLimitations();

    const exposedLimits: ExposedCurrencyLimitations = Object.entries(
      limits
    ).reduce((acc, [curr, limitation]) => {
      acc[curr as SupportedPaymentCurrencyTypes] = {
        ...limitation,
        zeroDecimalCurrency: zeroDecimalCurrencyTypes.includes(
          curr as SupportedPaymentCurrencyTypes
        ),
      };
      return acc;
    }, {} as ExposedCurrencyLimitations);

    ctx.body = {
      supportedCurrencies: supportedPaymentCurrencyTypes,
      limits: exposedLimits,
    };
    ctx.status = 200;
  } catch (error) {
    ctx.body = "Fiat Oracle Unavailable";
    ctx.status = 502;
  }

  return next;
}
