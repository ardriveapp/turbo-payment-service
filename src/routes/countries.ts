import { Next } from "koa";

import { ONE_HOUR_IN_SECONDS, recognizedCountries } from "../constants";
import { KoaContext } from "../server";

export async function countriesHandler(ctx: KoaContext, next: Next) {
  ctx.response.status = 200;
  ctx.body = recognizedCountries;
  ctx.set("Cache-Control", `max-age=${ONE_HOUR_IN_SECONDS}`);

  return next;
}
