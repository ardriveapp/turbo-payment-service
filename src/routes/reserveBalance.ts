import { Next } from "koa";

import { InsufficientBalance, UserNotFoundWarning } from "../database/errors";
import logger from "../logger";
import { KoaContext } from "../server";
import { ByteCount } from "../types/byteCount";

export async function reserveBalance(ctx: KoaContext, next: Next) {
  logger.child({ path: ctx.path });

  const { paymentDatabase, pricingService } = ctx.state;

  if (!ctx.request.headers.authorization || !ctx.state.user) {
    ctx.response.status = 401;
    ctx.body = "Unauthorized";
    return next;
  }

  let byteCount: ByteCount;
  let walletAddressToCredit: string;

  if (!ctx.params.walletAddress || !ctx.params.byteCount) {
    ctx.response.status = 403;
    ctx.body = "Missing parameters";
    return next;
  } else {
    try {
      byteCount = ByteCount(ctx.params.byteCount);
      walletAddressToCredit = ctx.params.walletAddress;
    } catch (error) {
      ctx.response.status = 403;
      ctx.body = "Invalid parameters";
      return next;
    }
  }

  try {
    const winstonCredits = await pricingService.getWCForBytes(byteCount);
    await paymentDatabase.reserveBalance(walletAddressToCredit, winstonCredits);
    ctx.response.status = 200;
    ctx.response.message = "Balance reserved";
    ctx.response.body = winstonCredits;

    logger.info("Balance reserved for user ", {
      walletAddressToCredit,
      winstonCredits,
    });

    return next;
  } catch (error: UserNotFoundWarning | InsufficientBalance | unknown) {
    if (error instanceof UserNotFoundWarning) {
      ctx.response.status = 403;
      ctx.response.message = "User not found";
      return next;
    }
    if (error instanceof InsufficientBalance) {
      ctx.response.status = 403;
      ctx.response.message = "Insufficient balance";
      return next;
    }
    logger.error("Error reserving balance", {
      walletAddressToCredit,
      byteCount,
      error,
    });

    ctx.response.status = 502;
    ctx.response.message = "Error reserving balance";
    return next;
  }
}
