import BigNumber from "bignumber.js";

import { CurrencyLimitations, paymentAmountLimits } from "../constants";
import { CurrencyType, PaymentAmount } from "../database/dbTypes";
import {
  InvalidPaymentAmount,
  PaymentAmountTooLarge,
  PaymentAmountTooSmall,
  UnsupportedCurrencyType,
} from "../database/errors";
import { WC } from "./arc";
import {
  SupportedPaymentCurrencyTypes,
  supportedPaymentCurrencyTypes,
  zeroDecimalCurrencyTypes,
} from "./supportedCurrencies";
import { Winston } from "./winston";

interface PaymentConstructorParams {
  amount: PaymentAmount;
  type: CurrencyType;
  currencyLimitations?: CurrencyLimitations;
}

function isSupportedCurrency(
  curr: string
): curr is SupportedPaymentCurrencyTypes {
  return supportedPaymentCurrencyTypes.includes(
    curr as SupportedPaymentCurrencyTypes
  );
}

export class Payment {
  public readonly amount: PaymentAmount;
  public readonly type: CurrencyType;

  constructor({
    amount,
    type,
    currencyLimitations = paymentAmountLimits,
  }: PaymentConstructorParams) {
    amount = Number(amount);
    type = type.toLowerCase();

    if (!isSupportedCurrency(type)) {
      throw new UnsupportedCurrencyType(type);
    }

    if (
      !Number.isInteger(amount) ||
      amount < 0 ||
      amount > Number.MAX_SAFE_INTEGER
    ) {
      throw new InvalidPaymentAmount(amount);
    }

    const maxAmountAllowed = currencyLimitations[type].maximumPaymentAmount;
    if (amount > maxAmountAllowed) {
      throw new PaymentAmountTooLarge(amount, type, maxAmountAllowed);
    }

    const minAmountAllowed = currencyLimitations[type].minimumPaymentAmount;
    if (amount < minAmountAllowed) {
      throw new PaymentAmountTooSmall(amount, type, minAmountAllowed);
    }

    this.amount = amount;
    this.type = type;
  }

  public winstonCreditAmountForARPrice(
    priceForOneAR: number,
    turboFeePercentageAsADecimal: number
  ): WC {
    const zeroDecimalAmount = zeroDecimalCurrencyTypes.includes(this.type)
      ? this.amount
      : this.amount / 100;

    const paymentAmountAfterFees =
      zeroDecimalAmount - zeroDecimalAmount * turboFeePercentageAsADecimal;

    const arcForPaymentAmount = paymentAmountAfterFees / priceForOneAR;

    return new Winston(
      BigNumber(arcForPaymentAmount).times(1_000_000_000_000).toFixed(0)
    );
  }
}
