import { Next } from "koa";

import logger from "../logger";
import { KoaContext } from "../server";

export async function priceFiat(ctx: KoaContext, next: Next) {
  logger.child({ path: ctx.path });
  const { pricingService } = ctx.state;

  const currency = ctx.params.currency;
  const value = ctx.params.value;

  const paymentProvider = ctx.request.header["x-payment-provider"];

  logger.info(" priceRoute", { currency, value, paymentProvider });

  //TODO - Do something with paymentProvider

  const price = await pricingService.getARCForFiat(currency, value);
  ctx.body = price;

  return next;
}
