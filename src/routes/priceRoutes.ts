import { Next } from "koa";

import { KoaContext } from "../server";
import { priceBytesHandler } from "./priceBytes";
import { priceFiatHandler } from "./priceFiat";

export async function priceRoutes(ctx: KoaContext, next: Next) {
  const currency = ctx.params.bytesOrCurrency;
  if (currency === "bytes") {
    return priceBytesHandler(ctx, next);
  } else {
    return priceFiatHandler(ctx, next);
  }
}
