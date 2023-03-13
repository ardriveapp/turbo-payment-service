import { Stripe } from "stripe";

import { Database } from "../../../database/database";
import logger from "../../../logger";
import { MetricRegistry } from "../../../metricRegistry";
import { PricingService } from "../../../pricing/pricing";
import { KoaContext } from "../../../server";
import { AR } from "../../../types/ar";

export async function handlePaymentSuccessEvent(
  pi: Stripe.PaymentIntent,
  ctx: KoaContext
) {
  const pricingService = ctx.architecture.pricingService as PricingService;
  const database = ctx.architecture.paymentDatabase as Database;
  const walletAddress = pi.metadata["address"];
  console.log(
    `🔔  Webhook received for Wallet ${walletAddress}: ${pi.status}!`
  );

  console.log(`💰 Payment captured!  ${pi.amount}}`);

  const paymentQuote = await database.getPriceQuote(walletAddress);
  if (paymentQuote) {
    logger.info(`Payment Quote found for ${walletAddress}`);
    const receipt = await database.createReceipt(walletAddress);

    logger.info(
      `Receipt created for ${walletAddress} ${JSON.stringify(receipt)}`
    );

    const winston = await pricingService.getARCForFiat(pi.currency, pi.amount);
    MetricRegistry.paymentSuccessCounter.inc();
    MetricRegistry.topUpsCounter.inc(Number(new AR(winston).valueOf()));
  } else {
    logger.info(`No payment quote found for ${walletAddress}`);
    throw new Error(`No payment quote found for ${walletAddress}`);
  }
}
