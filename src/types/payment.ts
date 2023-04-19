import BigNumber from "bignumber.js";

import { CurrencyType, PaymentAmount } from "../database/dbTypes";
import {
  InvalidPaymentAmount,
  UnsupportedCurrencyType,
} from "../database/errors";
import { WC } from "./arc";
import {
  supportedPaymentCurrencyTypes,
  zeroDecimalCurrencyTypes,
} from "./supportedCurrencies";
import { Winston } from "./winston";

interface PaymentConstructorParams {
  amount: PaymentAmount;
  type: CurrencyType;
}

export class Payment {
  public readonly amount: PaymentAmount;
  public readonly type: CurrencyType;

  constructor({ amount, type }: PaymentConstructorParams) {
    amount = Number(amount);
    type = type.toLowerCase();

    if (!supportedPaymentCurrencyTypes.includes(type)) {
      throw new UnsupportedCurrencyType(type);
    }

    if (
      !Number.isInteger(amount) ||
      amount < 0 ||
      amount > Number.MAX_SAFE_INTEGER
    ) {
      throw new InvalidPaymentAmount(amount);
    }

    this.amount = amount;
    this.type = type;
  }

  public winstonCreditAmountForARPrice(priceForOneAR: number): WC {
    const zeroDecimalAmount = zeroDecimalCurrencyTypes.includes(this.type)
      ? this.amount
      : this.amount / 100;

    const arcForPaymentAmount = zeroDecimalAmount / priceForOneAR;

    return new Winston(
      BigNumber(arcForPaymentAmount).times(1_000_000_000_000).toFixed(0)
    );
  }
}
