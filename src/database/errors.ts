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
import {
  CurrencyType,
  DataItemId,
  PaymentAmount,
  Timestamp,
  UserAddress,
} from "./dbTypes";

abstract class BaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class BadRequest extends BaseError {
  constructor(message: string) {
    super(message);
  }
}

export class UserNotFoundWarning extends BaseError {
  constructor(userAddress: UserAddress) {
    super(`No user found in database with address '${userAddress}'`);
  }
}

export class InsufficientBalance extends BaseError {
  constructor(userAddress: UserAddress) {
    super(`Insufficient balance for '${userAddress}'`);
  }
}

export abstract class PaymentValidationError extends BadRequest {}

export class UnsupportedCurrencyType extends PaymentValidationError {
  constructor(currencyType: CurrencyType) {
    super(
      `The currency type '${currencyType}' is currently not supported by this API!`
    );
  }
}

export class InvalidPaymentAmount extends PaymentValidationError {
  constructor(paymentAmount: PaymentAmount) {
    super(
      `The provided payment amount (${paymentAmount}) is invalid; it must be a positive non-decimal integer!`
    );
  }
}

export class PaymentAmountTooSmall extends PaymentValidationError {
  constructor(
    paymentAmount: PaymentAmount,
    currencyType: CurrencyType,
    minimumAllowedAmount: PaymentAmount
  ) {
    super(
      `The provided payment amount (${paymentAmount}) is too small for the currency type "${currencyType}"; it must be above ${minimumAllowedAmount}!`
    );
  }
}

export class PaymentAmountTooLarge extends PaymentValidationError {
  constructor(
    paymentAmount: PaymentAmount,
    currencyType: CurrencyType,
    maximumAllowedAmount: PaymentAmount
  ) {
    super(
      `The provided payment amount (${paymentAmount}) is too large for the currency type "${currencyType}"; it must be below or equal to ${maximumAllowedAmount}!`
    );
  }
}

export abstract class PromoCodeError extends BaseError {}

export class UserIneligibleForPromoCode extends PromoCodeError {
  constructor(userAddress: UserAddress, promoCode: string) {
    super(
      `The user '${userAddress}' is ineligible for the promo code '${promoCode}'`
    );
  }
}

export class PromoCodeNotFound extends PromoCodeError {
  constructor(promoCode: string) {
    super(`No promo code found with code '${promoCode}'`);
  }
}

export class PromoCodeExpired extends PromoCodeError {
  constructor(promoCode: string, endDate: Timestamp) {
    super(`The promo code '${promoCode}' expired on '${endDate}'`);
  }
}

export class PaymentAmountTooSmallForPromoCode extends PromoCodeError {
  constructor(promoCode: string, minimumPaymentAmount: PaymentAmount) {
    super(
      `The promo code '${promoCode}' can only used on payments above '${minimumPaymentAmount}'`
    );
  }
}

export class PromoCodeExceedsMaxUses extends PromoCodeError {
  constructor(promoCode: string, maxUses: number) {
    super(
      `The promo code '${promoCode}' has already been used the maximum number of times (${maxUses})`
    );
  }
}

export class GiftRedemptionError extends BaseError {
  constructor(errorMessage = "Failure to redeem payment receipt!") {
    super(errorMessage);
  }
}

export class GiftAlreadyRedeemed extends GiftRedemptionError {
  constructor() {
    super("Gift has already been redeemed!");
  }
}

export class BadQueryParam extends BadRequest {
  constructor(message?: string) {
    super(message ?? `Bad query parameter`);
  }
}

export class PaymentTransactionNotMined extends BaseError {
  constructor(transactionId: string) {
    super(`Transaction with id '${transactionId}' has not been mined yet!`);
  }
}

export class PaymentTransactionNotFound extends BaseError {
  constructor(transactionId: string) {
    super(`No payment transaction found with id '${transactionId}'`);
  }
}

export class PaymentTransactionHasWrongTarget extends BaseError {
  constructor(transactionId: string, targetAddress?: string) {
    super(
      `Payment transaction '${transactionId}' has wrong target address '${targetAddress}'`
    );
  }
}

export class TransactionNotAPaymentTransaction extends BaseError {
  constructor(transactionId: string) {
    super(
      `Transaction with id '${transactionId}' is not a payment transaction!`
    );
  }
}

export class PaymentTransactionRecipientOnExcludedList extends BaseError {
  constructor(transactionId: string, senderAddress: string) {
    super(
      `Payment transaction '${transactionId}' has sender that is on the excluded address list: '${senderAddress}'`
    );
  }
}

export class Unauthorized extends BaseError {
  constructor(message?: string) {
    super(message ?? "No authorization or user provided for authorized route!");
  }
}

export class CryptoPaymentTooSmallError extends BadRequest {
  constructor() {
    super(
      `Crypto payment amount is too small! Token value must convert to at least one winc`
    );
  }
}

export class ApprovalInvalid extends BadRequest {
  constructor(approvedAddress: string, payingAddress: string) {
    super(
      `No valid approvals for approved address '${approvedAddress}' and paying address '${payingAddress}'`
    );
  }
}

export class NoApprovalsFound extends BadRequest {
  constructor({
    approvedAddress,
    payingAddress,
  }: {
    approvedAddress: string;
    payingAddress: string;
  }) {
    super(
      `No valid approvals found for approved address '${approvedAddress}' and paying address '${payingAddress}'`
    );
  }
}

export class ConflictingApprovalFound extends BadRequest {
  constructor(approvalDataItemId: DataItemId) {
    super(`Conflicting approval found for approval ID '${approvalDataItemId}'`);
  }
}

export class ArNSPurchaseNotFound extends BaseError {
  constructor(nonce: string) {
    super(`No ArNS name purchase found in the database with nonce '${nonce}'`);
  }
}

export class ArNSPurchaseAlreadyExists extends BaseError {
  constructor(name: string, nonce: string) {
    super(
      `An ArNS name purchase for name '${name}' already exists in the database with nonce '${nonce}'`
    );
  }
}

export class InvalidArNSWalletType extends BaseError {
  constructor(walletType: string) {
    super(`Wallet type not yet implemented for ArNS Purchases '${walletType}'`);
  }
}
