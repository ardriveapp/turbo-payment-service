import { Next } from "koa";
import getRawBody from "raw-body";
import { Stripe } from "stripe";

import logger from "../../logger";
import { KoaContext } from "../../server";
import { handlePaymentFailedEvent } from "./eventHandlers/paymentFailedEventHandler";
import { handlePaymentSuccessEvent } from "./eventHandlers/paymentSuccessEventHandler";

require("dotenv").config();

let stripe: Stripe;

export async function stripeRoute(ctx: KoaContext, next: Next) {
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

  if (!STRIPE_SECRET_KEY || !WEBHOOK_SECRET) {
    throw new Error("Stripe secret key or webhook secret not set");
  }

  stripe ??= new Stripe(STRIPE_SECRET_KEY, {
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
  // Unawaited calls so we can return a response immediately.
  // TODO - Set the events we want to handle on stripe dashboard
  switch (event.type) {
    case "payment_intent.succeeded":
      handlePaymentSuccessEvent(paymentIntent, ctx);
      break;
    case "payment_intent.payment_failed":
      handlePaymentFailedEvent(paymentIntent);
      break;
    case "charge.dispute.created":
      logger.info(`Dispute created for ${walletAddress}`);
      break;
    case "charge.refund.created":
      logger.info(`Refund created for ${walletAddress}`);
      break;
    // ... handle other event types
    default:
      logger.info(`Unhandled event type ${event.type}`);
      ctx.status = 200;

      return;
  }

  // Return a 200 response to acknowledge receipt of the event.
  // Otherwise, Stripe will keep trying to send the event.
  // Handle errors internally
  ctx.status = 200;

  return next;
}
