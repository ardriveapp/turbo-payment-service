import { Stripe } from "stripe";

import { Database } from "../../../database/database";
import logger from "../../../logger";
import { MetricRegistry } from "../../../metricRegistry";

export async function handlePaymentFailedEvent(
  pi: Stripe.PaymentIntent,
  db: Database
) {
  const topUpQuoteId = pi.metadata["top_up_quote_id"];
  logger.info(`🔔  Webhook event payment failed event received!`, {
    topUpQuoteId,
    pi,
  });
  logger.info(`💸 Payment failed. ${pi.amount}`);

  await db.expireTopUpQuote(topUpQuoteId);
  MetricRegistry.paymentFailedCounter.inc();
}
