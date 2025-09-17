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

import { cryptoFundExcludedAddresses } from "../constants";
import {
  CreatePendingTransactionParams,
  CreditedPaymentTransaction,
  FailedPaymentTransaction,
} from "../database/dbTypes";
import {
  BadRequest,
  CryptoPaymentTooSmallError,
  PaymentTransactionHasWrongTarget,
  PaymentTransactionNotFound,
  PaymentTransactionNotMined,
  PaymentTransactionRecipientOnExcludedList,
} from "../database/errors";
import { KoaContext } from "../server";
import { W, isSupportedPaymentToken } from "../types";
import { sendCryptoFundSlackMessage } from "../utils/slack";
import { walletAddresses } from "./info";

export async function addPendingPaymentTx(ctx: KoaContext, _next: Next) {
  const { paymentDatabase, pricingService, gatewayMap } = ctx.state;
  let logger = ctx.state.logger;

  try {
    const rawBody = await getRawBody(ctx.req);
    let tx_id: string;
    try {
      const parsedBody = JSON.parse(rawBody.toString());
      tx_id = parsedBody.tx_id;
    } catch (error) {
      logger.error("Invalid JSON in request body", { error });
      throw new BadRequest("Invalid JSON in request body");
    }

    const token = ctx.params.token as string;

    logger = logger.child({ tx_id, token });

    if (!tx_id) {
      throw new BadRequest("Missing tx_id in request body");
    }

    if (!isSupportedPaymentToken(token)) {
      throw new BadRequest("Token not supported");
    }
    const gateway = gatewayMap[token];
    if (!gateway) {
      throw new Error("Gateway not found for currency!");
    }

    // Check if the transaction is already in the database
    const existingTx = await paymentDatabase.checkForPendingTransaction(tx_id);
    if (existingTx) {
      logger.debug("Found existing transaction", { existingTx });
      if ((existingTx as FailedPaymentTransaction).failedReason) {
        ctx.status = 400; // Bad Request
        ctx.body = {
          failedTransaction: existingTx,
          message: "Transaction has already failed!",
        };
        return;
      }

      if ((existingTx as CreditedPaymentTransaction).blockHeight) {
        ctx.status = 200; // OK
        ctx.body = {
          creditedTransaction: existingTx,
          message: "Transaction already credited",
        };
        return;
      }

      ctx.status = 202; // Accepted
      ctx.body = {
        pendingTransaction: existingTx,
        message: "Transaction already pending",
      };
      return;
    }

    const pendingTx = await gatewayMap[token].getTransaction(tx_id);

    if (+pendingTx.transactionQuantity <= 0) {
      throw new BadRequest("Transaction quantity must be greater than 0");
    }
    if (
      cryptoFundExcludedAddresses.includes(pendingTx.transactionSenderAddress)
    ) {
      throw new PaymentTransactionRecipientOnExcludedList(
        tx_id,
        pendingTx.transactionSenderAddress
      );
    }
    if (pendingTx.transactionRecipientAddress !== walletAddresses[token]) {
      throw new PaymentTransactionHasWrongTarget(
        tx_id,
        pendingTx.transactionRecipientAddress
      );
    }

    const { inclusiveAdjustments, finalPrice } =
      await pricingService.getWCForCryptoPayment({
        amount: W(pendingTx.transactionQuantity),
        token,
      });

    const txStatus = await gatewayMap[token].getTransactionStatus(tx_id);

    const newPendingTx: CreatePendingTransactionParams = {
      adjustments: inclusiveAdjustments,
      transactionId: tx_id,
      transactionQuantity: pendingTx.transactionQuantity,
      tokenType: token,
      destinationAddress: pendingTx.transactionSenderAddress,
      destinationAddressType: token,
      winstonCreditAmount: finalPrice.winc,
    };

    const newPendingWithoutCatalogIds = {
      ...newPendingTx,
      adjustments: newPendingTx.adjustments.map((adj) => {
        const { catalogId: _, ...rest } = adj;
        return rest;
      }),
    };

    if (txStatus.status === "confirmed") {
      const newCreditedTx = {
        ...newPendingTx,
        blockHeight: txStatus.blockHeight,
      };
      // User submitted an already confirmed transaction, credit it immediately
      await paymentDatabase.createNewCreditedTransaction(newCreditedTx);

      await sendCryptoFundSlackMessage({
        ...newCreditedTx,
        usdEquivalent: await pricingService.getUsdPriceForCryptoAmount({
          amount: newCreditedTx.transactionQuantity,
          token: newCreditedTx.tokenType,
        }),
      });
      ctx.status = 200; // OK
      ctx.body = {
        creditedTransaction: {
          ...newPendingWithoutCatalogIds,
          blockHeight: txStatus.blockHeight,
        },
        message: "Transaction credited",
      };
    } else {
      // User submitted a pending transaction, add it to the database for later processing
      await paymentDatabase.createPendingTransaction(newPendingTx);
      ctx.status = 202; // Accepted
      ctx.body = {
        pendingTransaction: newPendingWithoutCatalogIds,
        message: "Transaction pending",
      };
    }
  } catch (error) {
    logger.error("Error adding pending payment transaction", error, {
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    if (
      error instanceof BadRequest ||
      error instanceof PaymentTransactionHasWrongTarget ||
      error instanceof PaymentTransactionNotMined ||
      error instanceof CryptoPaymentTooSmallError
    ) {
      ctx.status = 400;
      ctx.body = error.message;
    } else if (error instanceof PaymentTransactionNotFound) {
      ctx.status = 404; // Matches Irys -- but should it be 400?
      ctx.body = "Transaction not found";
    } else if (error instanceof PaymentTransactionRecipientOnExcludedList) {
      ctx.status = 403;
      ctx.body = error.message;
    } else {
      ctx.status = 503;
      ctx.body =
        error instanceof Error ? error.message : "Internal server error";
    }
  }
}
