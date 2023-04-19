import BigNumber from "bignumber.js";

import {
  CurrencyType,
  PaymentAmount,
  PaymentProvider,
} from "../database/dbTypes";
import {
  InvalidPaymentAmount,
  UnsupportedCurrencyType,
  UnsupportedPaymentProvider,
} from "../database/errors";
import { WC } from "./arc";
import {
  supportedPaymentCurrencyTypes,
  zeroDecimalCurrencyTypes,
} from "./supportedCurrencies";
import { supportedPaymentProviders } from "./supportedPaymentProviders";
import { Winston } from "./winston";

interface PaymentConstructorParams {
  amount: PaymentAmount;
  type: CurrencyType;
  provider?: PaymentProvider;
}

export class Payment {
  public readonly amount: PaymentAmount;
  public readonly type: CurrencyType;
  public readonly provider;

  constructor({ amount, type, provider = "stripe" }: PaymentConstructorParams) {
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

    if (!supportedPaymentProviders.includes(provider)) {
      throw new UnsupportedPaymentProvider(provider);
    }

    this.amount = amount;
    this.type = type;
    this.provider = provider;
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
