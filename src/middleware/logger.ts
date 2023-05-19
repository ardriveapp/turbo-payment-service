import { randomUUID } from "crypto";
import { Next } from "koa";

import logger from "../logger";
import { KoaContext } from "../server";

export async function loggerMiddleware(ctx: KoaContext, next: Next) {
  const trace = randomUUID().substring(0, 6);
  const log = logger.child({
    trace,
    path: ctx.path,
    method: ctx.method,
    params: ctx.params,
  });
  ctx.state.logger = log;
  ctx.state.trace = trace;
  const startTime = Date.now();
  await next();
  const duration = Date.now() - startTime;
  log.debug("Completed request.", {
    responseTime: `${duration}ms`,
  });
}
