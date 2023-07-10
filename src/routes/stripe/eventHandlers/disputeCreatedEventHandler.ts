import { randomUUID } from "crypto";
import { Stripe } from "stripe";

import { maxAllowedChargebackDisputes } from "../../../constants.js";
import { Database } from "../../../database/database";
import logger from "../../../logger";
import { MetricRegistry } from "../../../metricRegistry";

export async function handleDisputeCreatedEvent(
  pi: Stripe.Dispute,
  paymentDatabase: Database,
  _stripe: Stripe // eslint-disable-line
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

  try {
    await paymentDatabase.createChargebackReceipt({
      chargebackReason: pi.reason,
      chargebackReceiptId,
      topUpQuoteId,
    });

    const totalWalletChargebacks =
      await paymentDatabase.getChargebackReceiptsForAddress(destinationAddress);

    if (totalWalletChargebacks.length > maxAllowedChargebackDisputes) {
      // TODO: tag a user in stripe as potentially fraudulent, block payments from card/customer
      logger.info(
        "Wallet has suspicious number of chargebacks. Tagging as potentially fraudulent in stripe.",
        {
          destinationAddress,
          totalWalletChargebacks,
          maxAllowedChargebackDisputes,
        }
      );
    }

    MetricRegistry.paymentChargebackCounter.inc();
    logger.info("Chargeback receipt created!", {
      chargebackReceiptId,
      topUpQuoteId,
    });
  } catch (error) {
    logger.error("Chargeback receipt failed!", {
      chargebackReceiptId,
      topUpQuoteId,
    });
    logger.error(error);
  }
}
