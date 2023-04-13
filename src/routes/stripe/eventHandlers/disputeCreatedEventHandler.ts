import { randomUUID } from "crypto";
import { Stripe } from "stripe";

import { Database } from "../../../database/database";
import logger from "../../../logger";
import { MetricRegistry } from "../../../metricRegistry";

export async function handleDisputeCreatedEvent(
  pi: Stripe.Dispute,
  paymentDatabase: Database
) {
  // TODO: Can we depend on this to be here on every chargeback?
  const topUpQuoteId = pi.metadata["top_up_quote_id"];
  logger.info(`🔔  Webhook Dispute Created Event!`, { topUpQuoteId, pi });
  const chargebackReceiptId = randomUUID();

  await paymentDatabase.createChargebackReceipt({
    chargebackReason: pi.reason,
    chargebackReceiptId,
    topUpQuoteId,
  });
  MetricRegistry.paymentFailedCounter.inc();

  logger.info("Chargeback receipt created!", { chargebackReceiptId });
}
