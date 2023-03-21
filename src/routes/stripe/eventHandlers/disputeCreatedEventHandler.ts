import { Stripe } from "stripe";

import { Database } from "../../../database/database";
import logger from "../../../logger";
import { MetricRegistry } from "../../../metricRegistry";
import { KoaContext } from "../../../server";

export async function handleDisputeCreatedEvent(
  pi: Stripe.Dispute,
  ctx: Partial<KoaContext>
) {
  const walletAddress = pi.metadata["address"];
  logger.info(
    `🔔  Webhook received for Wallet ${walletAddress}: ${pi.status}!`
  );
  logger.info(`💸 Dispute Created. ${pi.amount}`);
  const paymentDatabase = ctx.state?.paymentDatabase as Database;

  const priceQuote = await paymentDatabase.expirePriceQuote(walletAddress);
  if (priceQuote) {
    logger.info(`Payment Quote found for ${walletAddress}`);
    const oldBalance = await paymentDatabase.getUserBalance(walletAddress);
    const balance = await paymentDatabase.updateUserBalance(
      walletAddress,
      oldBalance.balance - priceQuote.balance
    );
    logger.info("Balance updated: " + JSON.stringify(balance));
  } else {
    logger.info(
      `No payment quote found for ${walletAddress}. Creating refund anyway.`
    );
  }
  const receipt = await paymentDatabase.createRefundReceipt(walletAddress);
  logger.info(
    `Refund Receipt created for ${walletAddress} ${JSON.stringify(receipt)}`
  );

  MetricRegistry.paymentFailedCounter.inc();
}
