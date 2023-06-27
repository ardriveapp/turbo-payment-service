import { Next } from "koa";

import { recognizedCountries } from "../constants";
import { KoaContext } from "../server";

export async function countriesHandler(ctx: KoaContext, next: Next) {
  try {
    ctx.response.status = 200;
    ctx.body = recognizedCountries;
  } catch (error) {
    ctx.response.status = 500;
    ctx.body = "Internal Server Error";
  }

  return next;
}
