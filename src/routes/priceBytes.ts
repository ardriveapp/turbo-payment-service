import { Next } from "koa";

import logger from "../logger";
import { KoaContext } from "../server";

export async function priceBytes(ctx: KoaContext, next: Next) {
  logger.child({ path: ctx.path });
  const { pricingService } = ctx.state;

  const bytes = ctx.params.value;
  logger.info(" price/bytes route", { bytes });
  try {
    const price = await pricingService.getARCForBytes(bytes);
    ctx.response.status = 200;
    ctx.body = price;

    return next;
  } catch (error) {
    logger.error(error);
    ctx.response.status = 404;
    ctx.body = error;

    return next;
  }
}
