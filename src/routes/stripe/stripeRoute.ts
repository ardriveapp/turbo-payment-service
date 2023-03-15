import { Next } from "koa";
import getRawBody from "raw-body";
import { Stripe } from "stripe";

import logger from "../../logger";
import { KoaContext } from "../../server";
import { handlePaymentFailedEvent } from "./eventHandlers/paymentFailedEventHandler";
import { handlePaymentSuccessEvent } from "./eventHandlers/paymentSuccessEventHandler";

export async function stripeRoute(ctx: KoaContext, next: Next) {
  const secretManager = ctx.architecture.secretManager;

  const STRIPE_SECRET_KEY = await secretManager.getStripeSecretKey();
  const WEBHOOK_SECRET = await secretManager.getStripeWebhookSecret();

  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2022-11-15",
    appInfo: {
      // For sample support and debugging, not required for production:
      name: "ardrive-turbo",
      version: "0.0.0",
    },
    typescript: true,
  });

  logger.child({ path: ctx.path });
  //get the webhook signature for verification
  const sig = ctx.request.headers["stripe-signature"] as string;
  const rawBody = await getRawBody(ctx.req);

  let event;

  try {
    logger.info("Verifying webhook signature...");

    event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
  } catch (err: any) {
    logger.info(`⚠️ Webhook signature verification failed.`);
    logger.info(err.message);
    ctx.status = 400;
    ctx.response.body = `Webhook Error: ${err.message}`;
    return;
  }

  // Extract the data from the event.
  const data: Stripe.Event.Data = event.data;
  const paymentIntent: Stripe.PaymentIntent =
    data.object as Stripe.PaymentIntent;
  // Funds have been captured
  const walletAddress = paymentIntent.metadata["address"];
  logger.info(
    `🔔  Webhook received for Wallet ${walletAddress}: ${paymentIntent.status}!`
  );
  switch (event.type) {
    case "payment_intent.succeeded":
      // Cast the event into a PaymentIntent to make use of the types.
      handlePaymentSuccessEvent(paymentIntent, ctx);
      ctx.status = 200;
      return next;
    case "payment_intent.payment_failed":
      handlePaymentFailedEvent(paymentIntent);
      ctx.status = 200;
      return next;
    case "payment_method.created":
      logger.info("PaymentMethod was created!", { walletAddress });
      break;
    case "payment_method.attached":
      logger.info("PaymentMethod was attached to a Customer!", { walletAddress });
      break;
    // ... handle other event types
    default:
      logger.info(`Unhandled event type ${event.type}`);
      ctx.status = 404;
      ctx.response.body = `Webhook Error: ${event.type}`;
      return;
  }

  return next;
}
