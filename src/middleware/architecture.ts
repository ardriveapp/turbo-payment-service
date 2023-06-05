import { Next } from "koa";

import { Architecture } from "../architecture";
import { KoaContext } from "../server";

export async function architectureMiddleware(
  ctx: KoaContext,
  next: Next,
  arch: Architecture
) {
  ctx.state.paymentDatabase = arch.paymentDatabase;
  ctx.state.pricingService = arch.pricingService;
  ctx.state.stripe = arch.stripe;
  return next();
}
