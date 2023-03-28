import { Stripe } from "stripe";

import { Database } from "../../../database/database";
import logger from "../../../logger";
import { MetricRegistry } from "../../../metricRegistry";

export async function handlePaymentFailedEvent(
  pi: Stripe.PaymentIntent,
  db: Database
) {
  const walletAddress = pi.metadata["address"];
  logger.info(
    `🔔  Webhook received for Wallet ${walletAddress}: ${pi.status}!`
  );
  logger.info(`💸 Payment failed. ${pi.amount}`);

  // TODO: This should be the topUpQuote ID
  await db.expireTopUpQuote(walletAddress);
  MetricRegistry.paymentFailedCounter.inc();
}
