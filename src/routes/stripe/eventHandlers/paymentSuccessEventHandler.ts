import { randomUUID } from "crypto";
import { Stripe } from "stripe";

import { Database } from "../../../database/database";
import logger from "../../../logger";
import { MetricRegistry } from "../../../metricRegistry";
import { KoaContext } from "../../../server";

export async function handlePaymentSuccessEvent(
  pi: Stripe.PaymentIntent,
  ctx: Partial<KoaContext>
) {
  const database = ctx.architecture.paymentDatabase as Database;
  const walletAddress = pi.metadata["address"];
  logger.info(
    `🔔  Webhook received for Wallet ${walletAddress}: ${pi.status}!`
  );

  logger.info(`💰 Payment captured!  ${pi.amount}}`);

  // TODO: We should pass the top up quote id
  const topUpQuote = await database.getTopUpQuote(walletAddress);

  const {
    amount,
    currencyType,
    destinationAddress,
    destinationAddressType,
    paymentProvider,
    quoteExpirationDate,
    topUpQuoteId,
    winstonCreditAmount,
  } = topUpQuote;

  // TODO: Check quote expiration date
  logger.info(quoteExpirationDate);

  if (topUpQuote) {
    logger.info(`Payment Quote found for ${walletAddress}`);
    const receipt = await database.createPaymentReceipt({
      amount,
      currencyType,
      destinationAddress,
      destinationAddressType,
      paymentProvider,
      // TODO: Use a receipt ID from Stripe or other payment provider?
      paymentReceiptId: randomUUID(),
      topUpQuoteId,
      winstonCreditAmount,
    });

    logger.info(
      `Receipt created for ${walletAddress} ${JSON.stringify(receipt)}`
    );

    MetricRegistry.paymentSuccessCounter.inc();
    MetricRegistry.topUpsCounter.inc(Number(topUpQuote.winstonCreditAmount));
  } else {
    logger.info(`No payment quote found for ${walletAddress}`);
    throw new Error(`No payment quote found for ${walletAddress}`);
  }
}
