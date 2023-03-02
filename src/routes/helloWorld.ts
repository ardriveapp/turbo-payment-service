import { Next } from "koa";

import logger from "../logger";
import { KoaContext } from "../server";

export async function helloWorldRoute(ctx: KoaContext, next: Next) {
  logger.child({ path: ctx.path });
  const helloWorld = "Hello World!!";

  logger.info(helloWorld);
  ctx.body = helloWorld;

  return next;
}
