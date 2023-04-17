import { randomUUID } from "crypto";
import { Stripe } from "stripe";

import { Database } from "../../../database/database";
import logger from "../../../logger";
import { MetricRegistry } from "../../../metricRegistry";

export async function handleDisputeCreatedEvent(
  pi: Stripe.Dispute,
  paymentDatabase: Database
) {
  // TODO: Can we depend on this top up quote id to be in the metadata on every chargeback event?
  const topUpQuoteId = pi.metadata["topUpQuoteId"];
  const destinationAddress = pi.metadata["destinationAddress"];
  logger.info(`🔔  Webhook Dispute Created Event!`, {
    topUpQuoteId,
    destinationAddress,
    pi,
  });

  const chargebackReceiptId = randomUUID();
  await paymentDatabase.createChargebackReceipt({
    chargebackReason: pi.reason,
    chargebackReceiptId,
    topUpQuoteId,
  });

  // TODO: Increment a chargebackReceiptCounter instead of paymentFailedCounter?
  MetricRegistry.paymentFailedCounter.inc();

  logger.info("Chargeback receipt created!", { chargebackReceiptId });
}
