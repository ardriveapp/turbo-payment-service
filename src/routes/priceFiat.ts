import { Next } from "koa";

import {
  PaymentAmountTooLarge,
  PaymentAmountTooSmall,
  PaymentValidationError,
} from "../database/errors";
import { KoaContext } from "../server";
import { Payment } from "../types/payment";

export async function priceFiatHandler(ctx: KoaContext, next: Next) {
  const logger = ctx.state.logger;
  const { pricingService } = ctx.state;

  let payment: Payment;
  try {
    payment = new Payment({
      amount: ctx.params.amount,
      type: ctx.params.currency,
    });
  } catch (error) {
    ctx.response.status = 400;
    ctx.body = (error as PaymentValidationError).message;
    return next;
  }
  logger.info("Payment Price GET Route :", { payment });

  try {
    const winstonCreditAmount = await pricingService.getWCForPayment(payment);

    logger.info("Base credit amount found for payment", {
      payment,
      winstonCreditAmount,
    });

    ctx.body = { winc: winstonCreditAmount.toString() };
    ctx.response.status = 200;
  } catch (error: unknown) {
    if (
      error instanceof PaymentAmountTooLarge ||
      error instanceof PaymentAmountTooSmall
    ) {
      ctx.response.status = 400;
      ctx.body = error.message;
      logger.info(error.message);
    } else {
      ctx.response.status = 502;
      ctx.body = "Fiat Oracle Unavailable";
    }
  }

  return next;
}
