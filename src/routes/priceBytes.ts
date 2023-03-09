import { Next } from "koa";

import logger from "../logger";
import { KoaContext } from "../server";
import { PositiveFiniteInteger } from "../types/types";

export async function priceBytes(ctx: KoaContext, next: Next) {
  logger.child({ path: ctx.path });
  const { pricingService } = ctx.state;

  const bytesValue = ctx.params.value;
  try {
    const bytes = new PositiveFiniteInteger(Number(bytesValue));
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
