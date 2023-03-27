import { Stripe } from "stripe";

import { Database } from "../../../database/database";
import logger from "../../../logger";
import { MetricRegistry } from "../../../metricRegistry";

export async function handleDisputeCreatedEvent(
  pi: Stripe.Dispute,
  paymentDatabase: Database
) {
  const walletAddress = pi.metadata["address"];
  logger.info(
    `🔔  Webhook received for Wallet ${walletAddress}: ${pi.status}!`
  );
  logger.info(`💸 Dispute Created. ${pi.amount}`);

  const priceQuote = await paymentDatabase.expirePriceQuote(walletAddress);
  const oldPaymentReceipt = await paymentDatabase.getPaymentReceipt(
    walletAddress
  );
  if (priceQuote) {
    logger.info(`Payment Quote found for ${walletAddress}`);
    const oldBalance = await paymentDatabase.getUserBalance(walletAddress);
    //TODO: Use BigNumber or Winston types for balance
    const balance = await paymentDatabase.updateUserBalance(
      walletAddress,
      oldBalance.balance - oldPaymentReceipt.balance
    );
    logger.info("Balance updated: ", balance);
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
