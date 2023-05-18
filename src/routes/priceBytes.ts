import { Next } from "koa";

import logger from "../logger";
import { KoaContext } from "../server";
import { ByteCount } from "../types/types";

export async function priceBytesHandler(ctx: KoaContext, next: Next) {
  logger.child({ path: ctx.path });
  const { pricingService } = ctx.state;

  const bytesValue = ctx.params.amount;

  logger.info("GET request for price of credits for a given byte count", {
    bytesValue,
  });

  if (Number(bytesValue) > Number.MAX_SAFE_INTEGER) {
    ctx.response.status = 400;
    ctx.body = "Byte count too large";
    logger.info("Byte count too large", { bytesValue });
    return next;
  }
  let bytes: ByteCount;
  try {
    bytes = ByteCount(Number(bytesValue));
  } catch (error) {
    ctx.response.status = 400;
    ctx.body = "Invalid byte count";
    logger.error("Invalid byte count", { bytesValue }, error);
    return next;
  }
  try {
    const price = await pricingService.getWCForBytes(bytes);
    ctx.response.status = 200;
    ctx.body = price;
    logger.info("Price found for byte count!", { price, bytesValue });
  } catch (error) {
    ctx.response.status = 502;
    ctx.body = "Pricing Oracle Unavailable";
    logger.error("Pricing Oracle Unavailable", { bytesValue });
  }
  return next;
}
