/**
 * Copyright (C) 2022-2023 Permanent Data Solutions, Inc. All Rights Reserved.
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

import { Database } from "../../../database/database";
import { EmailProvider } from "../../../emailProvider";
import logger from "../../../logger";
import { MetricRegistry } from "../../../metricRegistry";
import { triggerEmail } from "../../../triggerEmail";

export async function handlePaymentSuccessEvent(
  pi: Stripe.PaymentIntent,
  paymentDatabase: Database,
  stripe: Stripe,
  emailProvider?: EmailProvider
) {
  logger.info("💰 Payment Success Event Triggered", pi.metadata);

  const { topUpQuoteId, winstonCreditAmount } = pi.metadata;
  const paymentReceiptId = randomUUID();

  const loggerObject = {
    paymentReceiptId,
    ...pi.metadata,
  };
  try {
    if (!topUpQuoteId) {
      throw Error(
        'Payment intent metadata object must include key "topUpQuoteId" as a string value!'
      );
    }

    logger.info("Creating payment receipt...", loggerObject);

    const maybeUnredeemedGift = await paymentDatabase.createPaymentReceipt({
      paymentReceiptId,
      paymentAmount: pi.amount,
      currencyType: pi.currency,
      topUpQuoteId,
      senderEmail: pi.receipt_email ?? undefined,
    });

    logger.info(`💸 Payment Receipt created!`, loggerObject);

    MetricRegistry.paymentSuccessCounter.inc();
    MetricRegistry.topUpsCounter.inc(Number(winstonCreditAmount));

    if (maybeUnredeemedGift) {
      await triggerEmail(maybeUnredeemedGift, emailProvider);
    }
  } catch (error) {
    logger.error("❌ Payment receipt creation has failed!", loggerObject);
    logger.error(error);

    if (
      topUpQuoteId &&
      (await paymentDatabase.checkForExistingPaymentByTopUpQuoteId(
        topUpQuoteId
      ))
    ) {
      logger.error(
        "This top up quote ID exists in another state in the database!",
        loggerObject
      );
    } else {
      await refundPayment(stripe, pi.id, loggerObject);
    }
  }
}

async function refundPayment(
  stripe: Stripe,
  paymentIntentId: string,
  loggerObject: Record<string, unknown>
) {
  try {
    logger.info("Creating a Stripe refund for payment intent...", loggerObject);
    await stripe.refunds.create({ payment_intent: paymentIntentId });

    logger.info(
      "♻️ Payment successfully refunded through Stripe refund",
      loggerObject
    );
    MetricRegistry.paymentRefundedCounter.inc();
  } catch (error) {
    logger.error("⛔️ Payment refund has failed!", loggerObject);
    logger.error(error);
  }
}
