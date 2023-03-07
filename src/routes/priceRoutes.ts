import { Next } from "koa";

import { KoaContext } from "../server";
import { priceBytes } from "./priceBytes";
import { priceFiat } from "./priceFiat";

export async function priceRoutes(ctx: KoaContext, next: Next) {
  const currency = ctx.params.currency;
  if (currency === "bytes") {
    return priceBytes(ctx, next);
  } else {
    return priceFiat(ctx, next);
  }
}
