import { randomUUID } from "crypto";
import { Stripe } from "stripe";

import { Database } from "../../../database/database";
import logger from "../../../logger";
import { MetricRegistry } from "../../../metricRegistry";

export async function handlePaymentSuccessEvent(
  pi: Stripe.PaymentIntent,
  paymentDatabase: Database,
  stripe: Stripe
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

    await paymentDatabase.createPaymentReceipt({
      paymentReceiptId,
      paymentAmount: pi.amount,
      currencyType: pi.currency,
      topUpQuoteId,
    });

    logger.info(`💸 Payment Receipt created!`, loggerObject);

    MetricRegistry.paymentSuccessCounter.inc();
    MetricRegistry.topUpsCounter.inc(Number(winstonCreditAmount));
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
