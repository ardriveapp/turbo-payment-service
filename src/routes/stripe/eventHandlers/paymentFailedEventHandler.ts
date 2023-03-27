import { Stripe } from "stripe";

import { Database } from "../../../database/database";
import logger from "../../../logger";
import { MetricRegistry } from "../../../metricRegistry";
import { KoaContext } from "../../../server";

export async function handlePaymentFailedEvent(
  pi: Stripe.PaymentIntent,
  ctx: Partial<KoaContext>
) {
  const walletAddress = pi.metadata["address"];
  logger.info(
    `🔔  Webhook received for Wallet ${walletAddress}: ${pi.status}!`
  );
  logger.info(`💸 Payment failed. ${pi.amount}`);
  const paymentDatabase = ctx.state?.paymentDatabase as Database;

  // TODO: This should be the topUpQuote ID
  await paymentDatabase.expireTopUpQuote(walletAddress);
  MetricRegistry.paymentFailedCounter.inc();
}
