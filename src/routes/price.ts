import { Next } from "koa";

import logger from "../logger";
import { KoaContext } from "../server";

export async function priceRoute(ctx: KoaContext, next: Next) {
  logger.child({ path: ctx.path });
  const { pricingService } = ctx.state;

  const currency = ctx.params.currency;
  const value = ctx.params.value;
  logger.info(" priceRoute", { currency, value });

  const price = await pricingService.getARCForFiat(currency, value);
  ctx.body = price;

  return next;
}
