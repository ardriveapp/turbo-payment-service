// We will support these currencies on MVP
export const supportedPaymentCurrencyTypes = [
  "usd",
  "brl",
  "hkd",
  "jpy",
  "cad",
  "gbp",
  "eur",
  "sgd",
  "aud",
  "inr",
] as const;
export type SupportedPaymentCurrencyTypes =
  (typeof supportedPaymentCurrencyTypes)[number];

// Note: We will support these zero decimal currencies on MVP: [ 'jpy' ]
export const zeroDecimalCurrencyTypes = [
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
];

// Note: We won't support any three decimal currencies on MVP
export const threeDecimalCurrencyTypes = ["bhd", "jod", "kwd", "omr", "tnd"];
