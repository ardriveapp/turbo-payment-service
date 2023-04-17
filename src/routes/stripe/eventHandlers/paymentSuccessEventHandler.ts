import { randomUUID } from "crypto";
import { Stripe } from "stripe";

import { Database } from "../../../database/database";
import logger from "../../../logger";
import { MetricRegistry } from "../../../metricRegistry";

export async function handlePaymentSuccessEvent(
  pi: Stripe.PaymentIntent,
  paymentDatabase: Database
) {
  const topUpQuoteId = pi.metadata["topUpQuoteId"];
  const destinationAddress = pi.metadata["destinationAddress"];

  logger.info(`💰 Payment Success Event Triggered!`, {
    topUpQuoteId,
    destinationAddress,
    paymentAmount: pi.amount,
    currencyType: pi.currency,
  });

  const topUpQuote = await paymentDatabase.getTopUpQuote(topUpQuoteId);
  const paymentReceiptId = randomUUID();

  await paymentDatabase.createPaymentReceipt({
    paymentReceiptId,
    paymentAmount: pi.amount,
    currencyType: pi.currency,
    topUpQuoteId,
  });

  logger.info(`Payment Receipt created!`, { paymentReceiptId, topUpQuote });

  MetricRegistry.paymentSuccessCounter.inc();
  MetricRegistry.topUpsCounter.inc(Number(topUpQuote.winstonCreditAmount));
}
