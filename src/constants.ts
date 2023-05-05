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

export const stripeTestModeNJStateSalesTaxRateId =
  "txr_1N4R4qC8apPOWkDL9zUNtGer";
