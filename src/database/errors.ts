import { Payment } from "../types/payment";
import { CurrencyType, PaymentAmount, UserAddress } from "./dbTypes";

export class UserNotFoundWarning extends Error {
  constructor(userAddress: UserAddress) {
    super(`No user found in database with address '${userAddress}'`);
    this.name = "UserNotFoundWarning";
  }
}

export class InsufficientBalance extends Error {
  constructor(userAddress: UserAddress) {
    super(`Insufficient balance for '${userAddress}'`);
    this.name = "InsufficientBalance";
  }
}

export class UnsupportedCurrencyType extends Error {
  constructor(currencyType: CurrencyType) {
    super(
      `The currency type '${currencyType}' is currently not supported by this API!`
    );
    this.name = "UnsupportedCurrencyType";
  }
}

export class InvalidPaymentAmount extends Error {
  constructor(paymentAmount: PaymentAmount) {
    super(
      `The provided payment amount (${paymentAmount}) is invalid; it must be a positive non-decimal integer!`
    );
    this.name = "InvalidPaymentAmount";
  }
}

export type PaymentValidationErrors =
  | UnsupportedCurrencyType
  | InvalidPaymentAmount;

export class PaymentAmountTooSmall extends Error {
  constructor(payment: Payment, minimumAllowedAmount: PaymentAmount) {
    super(
      `The provided payment amount (${payment.amount}) is too small for the currency type "${payment.type}"; it must be above ${minimumAllowedAmount}!`
    );
    this.name = "PaymentAmountTooSmall";
  }
}

export class PaymentAmountTooLarge extends Error {
  constructor(payment: Payment, maximumAllowedAmount: PaymentAmount) {
    super(
      `The provided payment amount (${payment.amount}) is too large for the currency type "${payment.type}"; it must be below or equal to ${maximumAllowedAmount}!`
    );
    this.name = "PaymentAmountTooLarge";
  }
}

export type PaymentMinMaxLimitationErrors =
  | PaymentAmountTooSmall
  | PaymentAmountTooLarge;
