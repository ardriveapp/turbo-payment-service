import { Next } from "koa";

import { KoaContext } from "../server";

export async function reserveBalance(ctx: KoaContext, next: Next) {
  const { paymentDatabase } = ctx.state;

  const winstonCredits = ctx.params.winstonCredits;
  const walletAddress = ctx.params.walletAddress;

  if (!winstonCredits || !walletAddress) {
    ctx.response.status = 400;
    ctx.body = "Missing parameters";
    return next;
  }

  let user;
  try {
    user = await paymentDatabase.getUser(walletAddress);
  } catch (error) {
    ctx.response.status = 400;
    ctx.body = "User not found";
    return next;
  }

  if (user.winstonCreditBalance < winstonCredits) {
    ctx.response.status = 400;
    ctx.body = "Insufficient balance";
    return next;
  } else {
    try {
      await paymentDatabase.reserveBalance(walletAddress, winstonCredits);
      ctx.response.status = 200;
      ctx.body = "Balance reserved";
      return next;
    } catch (error) {
      ctx.response.status = 400;
      ctx.body = "Error reserving balance";
      return next;
    }
  }
}
