/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
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
  logger.debug(`🔔 Webhook Dispute Created Event!`, {
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

    logger.debug("Found payment intent related to dispute.", {
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
      walletBalanceAfterChargeback.winc.isNonZeroNegativeInteger() ||
      // TODO: we may want to filter within a certain period (e.g. 90/180 days)
      totalWalletChargebacks.length > maxAllowedChargebackDisputes
    ) {
      // TODO: tag a user in stripe as potentially fraudulent, block payments from card/customer
      logger.warn(
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
