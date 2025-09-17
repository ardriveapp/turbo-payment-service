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

import { GetBalanceResult } from "../database/dbTypes";
import {
  BadRequest,
  InsufficientBalance,
  Unauthorized,
  UserNotFoundWarning,
} from "../database/errors";
import { FinalPrice } from "../pricing/price";
import { KoaContext } from "../server";
import { W } from "../types";
import { remainingWincAmountFromApprovals } from "../utils/common";
import { getValidatedCheckBalanceParams } from "../utils/validators";

export async function checkBalance(ctx: KoaContext, next: Next) {
  const { paymentDatabase, pricingService, logger } = ctx.state;

  let signerBalance: GetBalanceResult | undefined;
  let finalPrice: FinalPrice | undefined;

  try {
    const { byteCount, paidBy, signerAddress } =
      getValidatedCheckBalanceParams(ctx);

    const payers =
      paidBy.length > 0 ? [...paidBy, signerAddress] : [signerAddress];
    const firstPayer = paidBy[0];

    const priceResponse = await pricingService.getWCForBytes(
      byteCount,
      firstPayer
    );
    finalPrice = priceResponse.finalPrice;
    const adjustments = priceResponse.adjustments;

    // If price is more than 0, check if user has sufficient balance
    if (finalPrice.winc.isZero() === false) {
      let remainingWincToCheckBalanceFor = finalPrice.winc;

      for (const payingAddress of payers) {
        if (payingAddress !== signerAddress) {
          const { givenApprovals } = await paymentDatabase.getBalance(
            payingAddress
          );
          // Check if the user has given approvals to the signer to cover the cost
          const approvals = givenApprovals.filter(
            (approval) => approval.approvedAddress === signerAddress
          );
          const totalApprovedAmountRemaining =
            remainingWincAmountFromApprovals(approvals);
          remainingWincToCheckBalanceFor =
            totalApprovedAmountRemaining.isGreaterThan(
              remainingWincToCheckBalanceFor
            )
              ? W("0")
              : remainingWincToCheckBalanceFor.minus(
                  totalApprovedAmountRemaining
                );
        } else {
          // Check if the user has sufficient balance to cover the cost
          signerBalance ??= await paymentDatabase.getBalance(signerAddress);
          remainingWincToCheckBalanceFor = remainingWincToCheckBalanceFor.minus(
            signerBalance.winc
          );
        }
      }

      if (remainingWincToCheckBalanceFor.isNonZeroPositiveInteger()) {
        throw new InsufficientBalance(signerAddress);
      }

      ctx.response.status = 200;
      ctx.response.message = "User has sufficient balance";
      ctx.body = {
        userHasSufficientBalance: true,
        bytesCostInWinc: finalPrice.winc.toString(),
        adjustments: adjustments,
        userBalanceInWinc: signerBalance?.effectiveBalance.toString(),
      };
    }
  } catch (error: UserNotFoundWarning | unknown) {
    if (error instanceof UserNotFoundWarning) {
      ctx.response.status = 404;
      ctx.response.message = "User not found";
      ctx.body = {
        userHasSufficientBalance: false,
        bytesCostInWinc: finalPrice?.winc.toString(),
        userBalanceInWinc: signerBalance?.effectiveBalance.toString(),
      };
    } else if (error instanceof InsufficientBalance) {
      ctx.response.status = 402;
      ctx.response.message = "Insufficient balance";
      ctx.body = {
        userHasSufficientBalance: false,
        bytesCostInWinc: finalPrice?.winc.toString(),
        userBalanceInWinc: signerBalance?.effectiveBalance.toString(),
      };
    } else if (error instanceof Unauthorized) {
      ctx.response.status = 401;
      ctx.body = error.message;
    } else if (error instanceof BadRequest) {
      ctx.response.status = 400;
      ctx.body = error.message;
    } else {
      logger.error("Error checking balance", {
        params: ctx.params,
        query: ctx.query,
        error: error,
      });

      ctx.response.status = 503;
      ctx.body = "Error checking balance";
    }
  }
  return next();
}
