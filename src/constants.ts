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

/** Min, max, and suggested payment amounts for the payment service */
export const paymentAmountLimits = {
  usd: { min: 10_00, max: 10_000_00, sugg: [25_00, 50_00, 100_00] },
  brl: { min: 50_00, max: 50_000_00, sugg: [125_00, 250_00, 500_00] },
  hkd: { min: 100_00, max: 100_000_00, sugg: [200_00, 400_00, 800_00] },
  jpy: { min: 1_500, max: 1_500_000, sugg: [3_500, 6_500, 15_000] },
  cad: { min: 10_00, max: 15_000_00, sugg: [25_00, 50_00, 100_00] },
  gbp: { min: 10_00, max: 10_000_00, sugg: [20_00, 40_00, 80_00] },
  eur: { min: 10_00, max: 10_000_00, sugg: [25_00, 50_00, 100_00] },
  sgd: { min: 15_00, max: 15_000_00, sugg: [25_00, 75_00, 150_00] },
  aud: { min: 15_00, max: 15_000_00, sugg: [25_00, 75_00, 150_00] },
  inr: { min: 1000_00, max: 900_000_00, sugg: [2000_00, 4000_00, 8000_00] },
};
