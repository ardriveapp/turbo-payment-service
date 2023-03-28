import { randomUUID } from "crypto";
import { Stripe } from "stripe";

import { Database } from "../../../database/database";
import logger from "../../../logger";
import { MetricRegistry } from "../../../metricRegistry";

export async function handlePaymentSuccessEvent(
  pi: Stripe.PaymentIntent,
  paymentDatabase: Database
) {
  const topUpQuoteId = pi.metadata["top_up_quote_id"];

  logger.info(`💰 Payment Success Event Triggered!`, {
    topUpQuoteId,
    amount: pi.amount,
  });

  const topUpQuote = await paymentDatabase.getTopUpQuote(topUpQuoteId);
  const paymentReceiptId = randomUUID();

  await paymentDatabase.createPaymentReceipt({
    ...topUpQuote,
    paymentReceiptId,
  });

  logger.info(`Payment Receipt created!`, { paymentReceiptId, topUpQuote });

  MetricRegistry.paymentSuccessCounter.inc();
  MetricRegistry.topUpsCounter.inc(Number(topUpQuote.winstonCreditAmount));
}
