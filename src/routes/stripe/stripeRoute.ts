import { Next } from "koa";
import getRawBody from "raw-body";
import { Stripe } from "stripe";

import logger from "../../logger";
import { KoaContext } from "../../server";
import { handleDisputeCreatedEvent } from "./eventHandlers/disputeCreatedEventHandler";
import { handlePaymentFailedEvent } from "./eventHandlers/paymentFailedEventHandler";
import { handlePaymentSuccessEvent } from "./eventHandlers/paymentSuccessEventHandler";

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
  const eventObject = data.object as
    | Stripe.PaymentIntent
    | Stripe.Charge
    | Stripe.Dispute;
  // Funds have been captured
  const walletAddress = eventObject.metadata["address"];
  logger.info(
    `🔔  Webhook received for Wallet ${walletAddress}: ${eventObject.status}!`
  );
  // Return a 200 response to acknowledge receipt of the event.
  // Otherwise, Stripe will keep trying to send the event.
  // Handle errors internally
  ctx.status = 200;

  // Unawaited calls so we can return a response immediately.
  // TODO - Set the events we want to handle on stripe dashboard

  switch (event.type) {
    case "payment_intent.succeeded":
      // Funds have been captured
      try {
        handlePaymentSuccessEvent(
          data.object as Stripe.PaymentIntent,
          ctx.state.paymentDatabase
        );
      } catch (error) {
        logger.error("Payment Success Event handler failed", error);
        ctx.status = 500;
      }
      break;
    case "payment_intent.payment_failed":
    case "payment_intent.canceled":
      try {
        handlePaymentFailedEvent(data.object as Stripe.PaymentIntent, ctx);
      } catch (error) {
        logger.error("Payment Failed/Cancelled Event handler failed", error);
        ctx.status = 500;
      }
      break;
    case "charge.dispute.created":
      try {
        handleDisputeCreatedEvent(
          data.object as Stripe.Dispute,
          ctx.state.paymentDatabase
        );
      } catch (error) {
        logger.error("Dispute Created Event handler failed", error);
        ctx.status = 500;
      }

      break;

    // ... handle other event types
    // If we see any events logged here that we don't handle, we should disable them on the stripe dashboard.
    default:
      logger.error(`Unhandled event type ${event.type}`);
      ctx.status = 500;
      return;
  }

  return next;
}
