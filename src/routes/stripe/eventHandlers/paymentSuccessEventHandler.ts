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

  const priceQuote = await database.getPriceQuote(walletAddress);
  if (priceQuote) {
    logger.info(`Payment Quote found for ${walletAddress}`);
    const receipt = await database.createPaymentReceipt(walletAddress);

    logger.info(
      `Receipt created for ${walletAddress} ${JSON.stringify(receipt)}`
    );

    MetricRegistry.paymentSuccessCounter.inc();
    MetricRegistry.topUpsCounter.inc(Number(priceQuote.balance));
  } else {
    logger.info(`No payment quote found for ${walletAddress}`);
    throw new Error(`No payment quote found for ${walletAddress}`);
  }
}
