import { Next } from "koa";

import { recognizedCountries } from "../constants";
import { KoaContext } from "../server";

export async function countriesHandler(ctx: KoaContext, next: Next) {
  ctx.response.status = 200;
  ctx.body = recognizedCountries;

  return next;
}
