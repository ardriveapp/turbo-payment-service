import { Next } from "koa";

import { PaymentValidationErrors } from "../database/errors";
import logger from "../logger";
import { KoaContext } from "../server";
import { Payment } from "../types/payment";

export async function priceFiatHandler(ctx: KoaContext, next: Next) {
  logger.child({ path: ctx.path });
  const { pricingService } = ctx.state;

  let payment: Payment;
  try {
    payment = new Payment({
      amount: ctx.params.amount,
      type: ctx.params.currency,
      provider:
        /* TODO: (ctx.request.header["x-payment-provider"] as string) ?? */ "stripe",
    });
  } catch (error) {
    ctx.response.status = 400;
    ctx.body = (error as PaymentValidationErrors).message;
    return next;
  }

  logger.info("Payment Price GET Route :", { payment });

  try {
    const winstonCreditAmount = await pricingService.getWCForPayment(payment);

    ctx.body = winstonCreditAmount;
    ctx.response.status = 200;
  } catch (error: any) {
    logger.error(error.message);
    ctx.response.status = 502;
    ctx.body = "Fiat Oracle Unavailable";
  }

  return next;
}
