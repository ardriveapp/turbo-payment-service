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

import { ArNSPurchase } from "../database/dbTypes";
import {
  BadRequest,
  InsufficientBalance,
  Unauthorized,
  UserNotFoundWarning,
} from "../database/errors";
import { KoaContext } from "../server";
import { W } from "../types";
import { getValidatedArNSPurchaseParams } from "../utils/validators";

export async function initiateArNSPurchase(ctx: KoaContext, next: Next) {
  const { paymentDatabase, logger, gatewayMap, pricingService } = ctx.state;
  const { ario } = gatewayMap;

  let purchaseReceipt: ArNSPurchase | undefined = undefined;
  try {
    const {
      intent,
      name,
      increaseQty,
      type,
      years,
      nonce,
      owner,
      processId,
      paidBy,
    } = getValidatedArNSPurchaseParams(ctx);

    const mARIOQty = await ario.getTokenCost({
      name,
      increaseQty,
      type,
      years,
      intent,
      assertBalance: true,
    });

    const { finalPrice } = await pricingService.getWCForCryptoPayment({
      amount: W(mARIOQty.valueOf()),
      token: "ario",
      // Just a quote for WC to use, don't include fees
      feeMode: "none",
    });
    const { usdArRate, usdArioRate } =
      await pricingService.getUSDPriceForOneARAndOneARIO();

    purchaseReceipt = await paymentDatabase.createArNSPurchaseReceipt({
      name,
      nonce,
      intent,
      mARIOQty,
      owner,
      wincQty: finalPrice.winc,
      processId,
      increaseQty,
      type,
      years,
      usdArRate,
      usdArioRate,
      paidBy,
    });

    const arioWriteResult = await ario.initiateArNSPurchase(purchaseReceipt);

    await paymentDatabase.addMessageIdToPurchaseReceipt({
      messageId: arioWriteResult.id,
      nonce: purchaseReceipt.nonce,
    });

    ctx.response.status = 200;
    ctx.response.message = "ArNS Purchase Successful";

    ctx.body = {
      purchaseReceipt: { ...purchaseReceipt, messageId: arioWriteResult.id },
      arioWriteResult,
    };
  } catch (error) {
    if (
      error instanceof BadRequest ||
      (error instanceof Error && error.name === "BadRequest")
    ) {
      ctx.response.status = 400;
      ctx.body = error.message;
    } else if (error instanceof Unauthorized) {
      ctx.response.status = 401;
      ctx.body = error.message;
    } else if (
      error instanceof InsufficientBalance ||
      error instanceof UserNotFoundWarning
    ) {
      ctx.response.status = 402;
      ctx.body = error.message;
    } else {
      logger.error("Error initiating ArNS Purchase", error, {
        query: ctx.query,
        params: ctx.params,
      });
      ctx.response.status = 503;
      ctx.body =
        error instanceof Error ? error.message : "Internal server error";
    }

    if (purchaseReceipt) {
      try {
        await paymentDatabase.updateFailedArNSPurchase(
          purchaseReceipt.nonce,
          "PURCHASE_FAILED"
        );
      } catch (error) {
        logger.error("Error updating failed ArNS Name purchase", error);
      }
    }
  }

  return next();
}
