import { Next } from "koa";

import logger from "../logger";
import { KoaContext } from "../server";

export async function priceFiatHandler(ctx: KoaContext, next: Next) {
  logger.child({ path: ctx.path });
  const { pricingService } = ctx.state;

  const currency = ctx.params.currency;
  const fiatAmount = ctx.params.amount;

  const paymentProvider = ctx.request.header["x-payment-provider"] ?? "stripe";

  logger.info(" priceRoute", { currency, fiatAmount, paymentProvider });

  //TODO - Do something with paymentProvider

  try {
    const price = await pricingService.getARCForFiat(currency, fiatAmount);
    ctx.body = price;
  } catch (error) {
    logger.error(error);
    ctx.response.status = 502;
    ctx.body = "Fiat Oracle Unavailable";
  }

  return next;
}
