import cors from "@koa/cors";
import Koa, { DefaultState, ParameterizedContext } from "koa";

import defaultArch, { Architecture } from "./architecture";
import { defaultPort } from "./constants";
import logger from "./logger";
import router from "./router";

type KoaState = DefaultState & Architecture;
export type KoaContext = ParameterizedContext<KoaState>;

logger.info(`Starting server with node environment ${process.env.NODE_ENV}...`);

export function createServer(
  arch: Partial<Architecture>,
  port: number = defaultPort
) {
  const app = new Koa();

  app.use(cors({ allowMethods: "GET" }));
  app.use(async (ctx: KoaContext, next) => {
    attachArchToKoaContext(ctx);

    try {
      await next();
    } catch (err) {
      logger.error(err);
    }
  });

  function attachArchToKoaContext(ctx: KoaContext): void {
    const { paymentDatabase, pricingService } = arch;

    ctx.state.paymentDatabase = paymentDatabase ?? defaultArch.paymentDatabase;
    ctx.state.pricingService = pricingService ?? defaultArch.pricingService;
  }

  app.use(router.routes());

  const server = app.listen(port);

  logger.info(`Listening on port ${port}...`);
  return server;
}
