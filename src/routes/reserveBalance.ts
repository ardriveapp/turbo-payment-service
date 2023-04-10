import { Next } from "koa";

import { KoaContext } from "../server";

export async function reserveBalance(ctx: KoaContext, next: Next) {
  const { paymentDatabase } = ctx.state;

  let wrc = ctx.params.winstonCredits;
  let walletAddress = ctx.params.walletAddress;

  if (!wrc || !walletAddress) {
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

  if (user.winstonCreditBalance < wrc) {
    ctx.response.status = 400;
    ctx.body = "Insufficient balance";
    return next;
  } else {
    try {
      await paymentDatabase.reserveBalance(walletAddress, wrc);
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
