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
