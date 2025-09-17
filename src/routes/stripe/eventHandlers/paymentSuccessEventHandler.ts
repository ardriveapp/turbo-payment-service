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
import { Logger } from "winston";

import { Architecture } from "../../../architecture";
import globalLogger from "../../../logger";
import { MetricRegistry } from "../../../metricRegistry";
import { triggerEmail } from "../../../triggerEmail";
import { handleArNSPurchaseEvent } from "./arnsEventHandler";

export async function handlePaymentSuccessEvent(
  pi: Stripe.PaymentIntent,
  arch: Architecture
) {
  const { paymentDatabase, stripe, emailProvider } = arch;
  let logger = globalLogger.child({ ...pi.metadata });
  logger.info("💰 Payment Success Event Triggered");

  if (isArNSPurchaseMetadata(pi.metadata)) {
    return handleArNSPurchaseEvent(pi, arch);
  }

  if (!isTopUpQuoteMetadata(pi.metadata)) {
    logger.error(
      "Payment intent metadata object must include key 'topUpQuoteId' as a string value!"
    );
    return;
  }

  const { topUpQuoteId, winstonCreditAmount } = pi.metadata;
  const paymentReceiptId = randomUUID();
  logger = logger.child({ paymentReceiptId });

  try {
    logger.debug("Creating payment receipt...");
    const maybeUnredeemedGift = await paymentDatabase.createPaymentReceipt({
      paymentReceiptId,
      paymentAmount: pi.amount,
      currencyType: pi.currency,
      topUpQuoteId,
      senderEmail: pi.receipt_email ?? undefined,
    });

    logger.info(`💸 Payment Receipt created!`);

    MetricRegistry.paymentSuccessCounter.inc();
    MetricRegistry.topUpsCounter.inc(Number(winstonCreditAmount));

    if (maybeUnredeemedGift) {
      await triggerEmail(maybeUnredeemedGift, emailProvider);
    }
  } catch (error) {
    logger.error("❌ Payment receipt creation has failed!");
    logger.error(error);

    if (
      topUpQuoteId &&
      (await paymentDatabase.checkForExistingPaymentByTopUpQuoteId(
        topUpQuoteId
      ))
    ) {
      logger.error(
        "This top up quote ID exists in another state in the database!"
      );
    } else {
      await refundPayment(stripe, pi.id, logger);
    }
  }
}

export async function refundPayment(
  stripe: Stripe,
  paymentIntentId: string,
  logger: Logger
) {
  try {
    logger.info("Creating a Stripe refund for payment intent...");
    await stripe.refunds.create({ payment_intent: paymentIntentId });

    logger.info("♻️ Payment successfully refunded through Stripe refund");
    MetricRegistry.paymentRefundedCounter.inc();
  } catch (error) {
    logger.error("⛔️ Payment refund has failed!");
    logger.error(error);
  }
}

type TopUpQuoteMetadata = Stripe.Metadata & {
  topUpQuoteId: string;
  winstonCreditAmount: string;
};

function isTopUpQuoteMetadata(
  metadata: Stripe.Metadata
): metadata is TopUpQuoteMetadata {
  return (
    "topUpQuoteId" in metadata &&
    typeof metadata.topUpQuoteId === "string" &&
    "winstonCreditAmount" in metadata &&
    typeof metadata.winstonCreditAmount === "string"
  );
}

type ArNSPurchaseMetadata = Stripe.Metadata & {
  nonce: string;
};

function isArNSPurchaseMetadata(
  metadata: Stripe.Metadata
): metadata is ArNSPurchaseMetadata {
  return "nonce" in metadata && typeof metadata.nonce === "string";
}
