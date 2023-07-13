import { randomUUID } from "crypto";
import { Stripe } from "stripe";

import { maxAllowedChargebackDisputes } from "../../../constants";
import { Database } from "../../../database/database";
import logger from "../../../logger";
import { MetricRegistry } from "../../../metricRegistry";

export async function handleDisputeCreatedEvent(
  pi: Stripe.Dispute,
  paymentDatabase: Database,
  stripe: Stripe
) {
  logger.info(`🔔 Webhook Dispute Created Event!`, {
    pi,
  });
  const chargebackReceiptId = randomUUID();
  try {
    const paymentIntentId = pi.payment_intent as string;
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (!paymentIntent) {
      throw new Error("Payment intent not found.");
    }

    // capture the payment intent destination address and top up quote id
    const { destinationAddress, topUpQuoteId } = paymentIntent.metadata;

    logger.info("Found payment intent related to dispute.", {
      disputeId: pi.id,
      paymentIntent,
    });

    await paymentDatabase.createChargebackReceipt({
      chargebackReason: pi.reason,
      chargebackReceiptId,
      topUpQuoteId,
    });

    MetricRegistry.paymentChargebackCounter.inc();

    logger.info("Chargeback receipt created!", {
      chargebackReceiptId,
      topUpQuoteId,
    });

    const [walletBalanceAfterChargeback, totalWalletChargebacks] =
      await Promise.all([
        paymentDatabase.getBalance(destinationAddress),
        paymentDatabase.getChargebackReceiptsForAddress(destinationAddress),
      ]);

    if (
      walletBalanceAfterChargeback.isNonZeroNegativeInteger() ||
      // TODO: we may want to filter within a certain period (e.g. 90/180 days)
      totalWalletChargebacks.length > maxAllowedChargebackDisputes
    ) {
      // TODO: tag a user in stripe as potentially fraudulent, block payments from card/customer
      logger.info(
        "Wallet has suspicious number of chargebacks and/or a negative balance.",
        {
          destinationAddress,
          totalWalletChargebacks,
          maxAllowedChargebackDisputes,
          balance: walletBalanceAfterChargeback,
        }
      );
      MetricRegistry.suspiciousWalletActivity.inc();
    }
  } catch (error) {
    logger.error("Chargeback receipt failed!", {
      chargebackReceiptId,
      error,
    });
    MetricRegistry.failedChargebackCounter.inc();
  }
}
