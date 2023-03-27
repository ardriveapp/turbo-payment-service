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

  // TODO: What ID is pi.charge? should we use this as Payment Receipt ID in this DB?
  // pi.charge;

  // What comes back from a dispute object?
  // We could query the DB for a payment receipt based on the amount and address
  const oldPaymentReceipt = await paymentDatabase.getPaymentReceipt(
    // TODO: This should be the payment receipt ID or top up quote ID
    walletAddress
  );

  if (oldPaymentReceipt) {
    const receipt = await paymentDatabase.createChargebackReceipt({
      ...oldPaymentReceipt,
      chargebackReason: "Stripe Webhook Dispute Event",
      chargebackReceiptId: pi.id,
    });
    MetricRegistry.paymentFailedCounter.inc();
    logger.info(
      `Chargeback Receipt created for ${walletAddress} ${JSON.stringify(
        receipt
      )}`
    );
  } else {
    throw Error(`No payment receipt found for ${walletAddress}!`);
  }
}
