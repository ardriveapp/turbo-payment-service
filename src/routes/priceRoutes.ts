import { Next } from "koa";

import { KoaContext } from "../server";
import { priceBytesHandler } from "./priceBytes";
import { priceFiatHandler } from "./priceFiat";

export async function priceRoutes(ctx: KoaContext, next: Next) {
  const currency = ctx.params.currency ?? "bytes";

  const walletAddress = ctx.state.walletAddress;
  if (walletAddress) {
    // TODO: Put any promotional info from the DB that may change pricing calculations into state
  }

  if (currency === "bytes") {
    return priceBytesHandler(ctx, next);
  } else {
    return priceFiatHandler(ctx, next);
  }
}
