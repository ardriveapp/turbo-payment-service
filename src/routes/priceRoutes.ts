import { Next } from "koa";

import { KoaContext } from "../server";
import { priceBytesHandler } from "./priceBytes";
import { priceFiatHandler } from "./priceFiat";

export async function priceRoutes(ctx: KoaContext, next: Next) {
  let currency = ctx.params.currency ?? "bytes";

  if (currency === "bytes") {
    return priceBytesHandler(ctx, next);
  } else {
    return priceFiatHandler(ctx, next);
  }
}
