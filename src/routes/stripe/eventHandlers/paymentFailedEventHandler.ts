import { Stripe } from "stripe";

import logger from "../../../logger";
import { MetricRegistry } from "../../../metricRegistry";

export function handlePaymentFailedEvent(pi: Stripe.PaymentIntent) {
  logger.info(`💸 Payment failed. ${pi.amount}`);
  MetricRegistry.paymentFailedCounter.inc();
}
