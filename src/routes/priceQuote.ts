import { Next } from "koa";

import logger from "../logger";
import { KoaContext } from "../server";

export async function priceQuoteRoute(ctx: KoaContext, next: Next) {
  logger.child({ path: ctx.path });
  const { pricingService } = ctx.state;

  const bytes = ctx.params.bytes;
  logger.info(" priceQuoteRoute", { bytes });

  const price = await pricingService.getARCForBytes(bytes);
  ctx.body = price;

  return next;
}
