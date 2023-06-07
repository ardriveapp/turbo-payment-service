import { SupportedPaymentCurrencyTypes } from "./types/supportedCurrencies";

export const isTestEnv = process.env.NODE_ENV === "test";

const testEnvPort = 1235;
const prodEnvPort = 3000;

export const defaultPort = isTestEnv ? testEnvPort : prodEnvPort;
export const msPerMinute = 1000 * 60;

export const paymentIntentTopUpMethod = "payment-intent";
export const checkoutSessionTopUpMethod = "checkout-session";

export const topUpMethods = [
  paymentIntentTopUpMethod,
  checkoutSessionTopUpMethod,
] as const;

export const TEST_PRIVATE_ROUTE_SECRET = "test-secret";

export const turboFeePercentageAsADecimal = 0.2;

// cspell:disable
export const electronicallySuppliedServicesTaxCode = "txcd_10000000"; //cspell:disable

/** Min, maximumPaymentAmount, and suggestedPaymentAmountsested payment amounts for the payment service */
export const paymentAmountLimits: CurrencyLimitations = {
  aud: {
    minimumPaymentAmount: 15_00,
    maximumPaymentAmount: 15_000_00,
    suggestedPaymentAmounts: [25_00, 75_00, 150_00],
  },
  brl: {
    minimumPaymentAmount: 50_00,
    maximumPaymentAmount: 50_000_00,
    suggestedPaymentAmounts: [125_00, 250_00, 500_00],
  },
  cad: {
    minimumPaymentAmount: 10_00,
    maximumPaymentAmount: 15_000_00,
    suggestedPaymentAmounts: [25_00, 50_00, 100_00],
  },
  eur: {
    minimumPaymentAmount: 10_00,
    maximumPaymentAmount: 10_000_00,
    suggestedPaymentAmounts: [25_00, 50_00, 100_00],
  },
  gbp: {
    minimumPaymentAmount: 10_00,
    maximumPaymentAmount: 10_000_00,
    suggestedPaymentAmounts: [20_00, 40_00, 80_00],
  },
  hkd: {
    minimumPaymentAmount: 100_00,
    maximumPaymentAmount: 100_000_00,
    suggestedPaymentAmounts: [200_00, 400_00, 800_00],
  },
  inr: {
    minimumPaymentAmount: 1000_00,
    maximumPaymentAmount: 900_000_00,
    suggestedPaymentAmounts: [2000_00, 4000_00, 8000_00],
  },
  jpy: {
    minimumPaymentAmount: 1_500,
    maximumPaymentAmount: 1_500_000,
    suggestedPaymentAmounts: [3_500, 6_500, 15_000],
  },
  sgd: {
    minimumPaymentAmount: 15_00,
    maximumPaymentAmount: 15_000_00,
    suggestedPaymentAmounts: [25_00, 75_00, 150_00],
  },
  usd: {
    minimumPaymentAmount: 10_00,
    maximumPaymentAmount: 10_000_00,
    suggestedPaymentAmounts: [25_00, 50_00, 100_00],
  },
};
export interface CurrencyLimitation {
  minimumPaymentAmount: number;
  maximumPaymentAmount: number;
  suggestedPaymentAmounts: readonly [number, number, number];
}

export interface ExposedCurrencyLimitation extends CurrencyLimitation {
  zeroDecimalCurrency: boolean;
}

export type ExposedCurrencyLimitations = Record<
  SupportedPaymentCurrencyTypes,
  ExposedCurrencyLimitation
>;

export type CurrencyLimitations = Record<
  SupportedPaymentCurrencyTypes,
  CurrencyLimitation
>;
