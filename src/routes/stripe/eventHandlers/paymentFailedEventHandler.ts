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

  const priceQuote = await paymentDatabase.expirePriceQuote(walletAddress);
  if (priceQuote) {
    logger.info(`Payment Quote found for ${walletAddress}`);
  } else {
    logger.info(`No payment quote found for ${walletAddress}`);
  }
  const receipt = await paymentDatabase.createRefundReceipt(walletAddress);
  logger.info(
    `Refund Receipt created for ${walletAddress} ${JSON.stringify(receipt)}`
  );

  MetricRegistry.paymentFailedCounter.inc();
}
