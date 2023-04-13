import { Next } from "koa";

import logger from "../logger";
import { KoaContext } from "../server";
import { ByteCount } from "../types/types";

export async function priceBytesHandler(ctx: KoaContext, next: Next) {
  logger.child({ path: ctx.path });
  const { pricingService } = ctx.state;

  const bytesValue = ctx.params.amount;
  if (Number(bytesValue) > Number.MAX_SAFE_INTEGER) {
    ctx.response.status = 400;
    ctx.message = "Byte count too large";
    return next;
  }
  let bytes: ByteCount;
  try {
    bytes = ByteCount(Number(bytesValue));
  } catch (error) {
    logger.error(error);
    ctx.response.status = 400;
    ctx.body = "Invalid byte count";
    return next;
  }
  //TODO - Hit db and return 503 if unavailable
  try {
    const price = await pricingService.getWCForBytes(bytes);
    ctx.response.status = 200;
    ctx.body = price;
  } catch (error) {
    logger.error(error);
    ctx.response.status = 502;
    ctx.body = "Pricing Oracle Unavailable";
  }
  return next;
}
