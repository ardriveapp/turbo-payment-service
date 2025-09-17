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
import Stripe from "stripe";

import { Architecture } from "../../../architecture";
import { stripePaymentQuoteExpirationMs } from "../../../constants";
import { successPurchaseStatus } from "../../../database/dbTypes";
import globalLogger from "../../../logger";
import { MetricRegistry } from "../../../metricRegistry";
import { sleep } from "../../../utils/common";
import { refundPayment } from "./paymentSuccessEventHandler";

export async function handleArNSPurchaseEvent(
  pi: Stripe.PaymentIntent,
  arch: Architecture
) {
  const { paymentDatabase, stripe, gatewayMap } = arch;
  const { ario } = gatewayMap;
  let logger = globalLogger.child({
    ...pi.metadata,
  });

  const { nonce } = pi.metadata;

  try {
    logger.debug("Received payment intent for ArNS purchase");
    const { quote } = await paymentDatabase.getArNSPurchaseQuote(nonce);
    logger = logger.child({ ...quote });

    if (
      new Date(quote.quoteExpirationDate) <
      new Date(Date.now() - stripePaymentQuoteExpirationMs)
    ) {
      throw new Error(`ArNS purchase quote with nonce ${nonce} has expired!`);
    }

    try {
      const arioWriteResult = await ario.initiateArNSPurchase(quote);
      logger = logger.child({ arioWriteResult });
      logger.debug("ArNS purchase quote successfully initiated with ARIO!");

      await paymentDatabase.updateArNSPurchaseQuoteToSuccess({
        nonce,
        messageId: arioWriteResult.id,
      });
      MetricRegistry.arnsPurchaseQuoteSuccessCounter.inc();
      logger.info(
        "ArNS purchase quote successfully updated to success status!"
      );
    } catch (error) {
      await paymentDatabase.updateArNSPurchaseQuoteToFailure(
        nonce,
        "PURCHASE_FAILED"
      );
      throw Error(`Failed to initiate ArNS purchase with ARIO: ${error}`);
    }
  } catch (error) {
    await sleep(1000); // wait for 1 second before checking the status to allow for replication lag

    const purchaseQuote = await paymentDatabase.getArNSPurchaseStatus(nonce);
    if (purchaseQuote && purchaseQuote.status === successPurchaseStatus) {
      logger.error(
        "This ArNS purchase quote has success status in the database! Not refunding the payment."
      );
      return;
    }
    await refundPayment(stripe, pi.id, logger);
    logger.error(
      "This ArNS purchase quote has failed in this task and not found been as successful in database. Refunding the payment."
    );
    logger.error(error);
    MetricRegistry.arnsPurchaseQuoteFailedCounter.inc();
    return;
  }
}
