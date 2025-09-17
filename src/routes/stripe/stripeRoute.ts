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
import { Next } from "koa";
import getRawBody from "raw-body";
import { Stripe } from "stripe";

import { KoaContext } from "../../server";
import { handleDisputeCreatedEvent } from "./eventHandlers/disputeCreatedEventHandler";
import { handlePaymentSuccessEvent } from "./eventHandlers/paymentSuccessEventHandler";

export async function stripeRoute(ctx: KoaContext, next: Next) {
  const logger = ctx.state.logger;

  const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    throw new Error("Stripe webhook secret not set");
  }

  const stripe = ctx.state.stripe;

  // get the webhook signature and raw body for verification
  const sig = ctx.request.headers["stripe-signature"] as string;
  const rawBody = await getRawBody(ctx.req);

  let event;

  try {
    logger.debug("Verifying stripe webhook signature...");

    event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
  } catch (err: unknown) {
    logger.warn(`⚠️ Webhook signature verification failed.`);
    logger.error(err);
    ctx.status = 400;
    ctx.response.body = `Webhook Error!`;
    return next();
  }

  // Extract the data from the event.
  const data: Stripe.Event.Data = event.data;
  const eventObject = data.object as
    | Stripe.PaymentIntent
    | Stripe.Charge
    | Stripe.Dispute;

  const loggerObject = { eventType: event.type, ...eventObject.metadata };
  // Funds have been captured
  logger.info("🔔 Stripe webhook event received", loggerObject);
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
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        handlePaymentSuccessEvent(
          data.object as Stripe.PaymentIntent,
          ctx.state
        );
      } catch (error) {
        logger.error(
          "Payment Success Event handler failed",
          error,
          loggerObject
        );
      }
      break;
    case "charge.dispute.created":
      try {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        handleDisputeCreatedEvent(
          data.object as Stripe.Dispute,
          ctx.state.paymentDatabase,
          stripe
        );
      } catch (error) {
        logger.error(
          "Dispute Created Event handler failed",
          error,
          loggerObject
        );
      }

      break;

    // ... handle other event types
    // If we see any events logged here that we don't handle, we should disable them on the stripe dashboard.
    default:
      logger.error(`Unhandled event type`, loggerObject);

      return;
  }

  return next();
}
