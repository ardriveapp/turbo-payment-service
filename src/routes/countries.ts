import { Next } from "koa";

import { oneHourInSeconds, recognizedCountries } from "../constants";
import { KoaContext } from "../server";

export async function countriesHandler(ctx: KoaContext, next: Next) {
  ctx.response.status = 200;
  ctx.body = recognizedCountries;
  ctx.set("Cache-Control", `max-age=${oneHourInSeconds}`);

  return next();
}
