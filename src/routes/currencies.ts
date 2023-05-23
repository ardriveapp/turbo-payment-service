import { Next } from "koa";

import { KoaContext } from "../server";
import { supportedPaymentCurrencyTypes } from "../types/supportedCurrencies";

export async function currenciesRoute(ctx: KoaContext, next: Next) {
  const logger = ctx.state.logger;

  logger.info("Currencies requested");

  ctx.body = { supportedCurrencies: supportedPaymentCurrencyTypes };
  ctx.status = 200;

  return next;
}
