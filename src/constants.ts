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
import { ByteCount } from "./types/byteCount";
import { SupportedFiatPaymentCurrencyType } from "./types/supportedCurrencies";

export const isTestEnv = process.env.NODE_ENV === "test";
export const isDevEnv = process.env.NODE_ENV === "dev";

export const migrateOnStartup = process.env.MIGRATE_ON_STARTUP === "true";
export const defaultPort = +(process.env.PORT ?? 3000);
export const msPerMinute = 1000 * 60;
export const oneHourInSeconds = 3600;
export const oneMinuteInSeconds = 60;
export const paymentIntentStripeMethod = "payment-intent";
export const checkoutSessionStripeMethod = "checkout-session";

export const oneGiBInBytes = ByteCount(1024 * 1024 * 1024);
export const oneARInWinston = 1e12;
// the number of existing charge-backs recorded before we mark a wallet as fraudulent
export const maxAllowedChargebackDisputes = +(
  process.env.MAX_ALLOWED_CHARGE_BACKS ?? 1
);

export const stripePaymentMethods = [
  paymentIntentStripeMethod,
  checkoutSessionStripeMethod,
] as const;
export type StripePaymentMethod = (typeof stripePaymentMethods)[number];

export const TEST_PRIVATE_ROUTE_SECRET = "test-secret";

// cspell:disable
export const electronicallySuppliedServicesTaxCode = "txcd_10000000"; //cspell:disable

/** Min, maximumPaymentAmount, and suggestedPaymentAmountsested payment amounts for the payment service */
export const paymentAmountLimits: CurrencyLimitations = {
  aud: {
    minimumPaymentAmount: 7500,
    maximumPaymentAmount: 15_000_00,
    suggestedPaymentAmounts: [25_00, 75_00, 150_00],
    stripeMinimumPaymentAmount: 50,
  },
  brl: {
    minimumPaymentAmount: 2500,
    maximumPaymentAmount: 10_000_00,
    suggestedPaymentAmounts: [125_00, 250_00, 500_00],
    stripeMinimumPaymentAmount: 50,
  },
  cad: {
    minimumPaymentAmount: 500,
    maximumPaymentAmount: 10_000_00,
    suggestedPaymentAmounts: [25_00, 50_00, 100_00],
    stripeMinimumPaymentAmount: 50,
  },
  eur: {
    minimumPaymentAmount: 500,
    maximumPaymentAmount: 10_000_00,
    suggestedPaymentAmounts: [25_00, 50_00, 100_00],
    stripeMinimumPaymentAmount: 50,
  },
  gbp: {
    minimumPaymentAmount: 500,
    maximumPaymentAmount: 10_000_00,
    suggestedPaymentAmounts: [20_00, 40_00, 80_00],
    stripeMinimumPaymentAmount: 30,
  },
  hkd: {
    minimumPaymentAmount: 5000,
    maximumPaymentAmount: 100_000_00,
    suggestedPaymentAmounts: [200_00, 400_00, 800_00],
    stripeMinimumPaymentAmount: 400,
  },
  inr: {
    minimumPaymentAmount: 50_000,
    maximumPaymentAmount: 900_000_00,
    suggestedPaymentAmounts: [2000_00, 4000_00, 8000_00],
    stripeMinimumPaymentAmount: 1000,
  },
  jpy: {
    minimumPaymentAmount: 750,
    maximumPaymentAmount: 1_500_000,
    suggestedPaymentAmounts: [3_500, 6_500, 15_000],
    stripeMinimumPaymentAmount: 120,
  },
  sgd: {
    minimumPaymentAmount: 750,
    maximumPaymentAmount: 15_000_00,
    suggestedPaymentAmounts: [25_00, 75_00, 150_00],
    stripeMinimumPaymentAmount: 50,
  },
  usd: {
    minimumPaymentAmount: 500,
    maximumPaymentAmount: 10_000_00,
    suggestedPaymentAmounts: [25_00, 50_00, 100_00],
    stripeMinimumPaymentAmount: 50,
  },
} as const;

export interface CurrencyLimitation {
  stripeMinimumPaymentAmount: number;
  minimumPaymentAmount: number;
  maximumPaymentAmount: number;
  suggestedPaymentAmounts: readonly [number, number, number];
}

export interface ExposedCurrencyLimitation extends CurrencyLimitation {
  zeroDecimalCurrency: boolean;
}

export type ExposedCurrencyLimitations = Record<
  SupportedFiatPaymentCurrencyType,
  ExposedCurrencyLimitation
>;

export type CurrencyLimitations = Record<
  SupportedFiatPaymentCurrencyType,
  CurrencyLimitation
>;

export const recognizedCountries = [
  "United States",
  "United Kingdom",
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Antigua and Barbuda",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cabo Verde",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Comoros",
  "Congo",
  "Costa Rica",
  "Cote d'Ivoire",
  "Croatia",
  "Cyprus",
  "Czech Republic",
  "Democratic Republic of the Congo",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "East Timor",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Eswatini",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Grenada",
  "Guatemala",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Honduras",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Micronesia",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Palau",
  "Palestine",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Korea",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Sweden",
  "Switzerland",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Togo",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Vatican City",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe",
] as const;

export const promoCodeBackfills = {
  welcomeTwentyPercentOff: "TOKEN2049",
};

export const maxGiftMessageLength = process.env.MAX_GIFT_MESSAGE_LENGTH ?? 250;

export const giftingEmailAddress =
  process.env.GIFTING_EMAIL_ADDRESS ?? "gift@ardrive.io";

export const defaultTopUpCheckoutSuccessUrl = "https://app.ardrive.io";
export const defaultTopUpCheckoutCancelUrl = "https://app.ardrive.io";

export const defaultArNSCheckoutSuccessUrl = "https://arns.app";
export const defaultArNSCheckoutCancelUrl = "https://arns.app";

/** gifting on top up via email depends on GIFTING_ENABLED="true" env var */
export const isGiftingEnabled = process.env.GIFTING_ENABLED === "true";

export const gatewayUrls = {
  arweave: new URL(process.env.ARWEAVE_GATEWAY || "https://arweave.net:443"),
  ethereum: new URL(
    process.env.ETHEREUM_GATEWAY || "https://cloudflare-eth.com/"
  ),
  matic: new URL(process.env.MATIC_GATEWAY || "https://polygon-rpc.com/"),
  pol: new URL(process.env.MATIC_GATEWAY || "https://polygon-rpc.com/"),
  solana: new URL(
    process.env.SOLANA_GATEWAY || "https://api.mainnet-beta.solana.com/"
  ),
  kyve: new URL(process.env.KYVE_GATEWAY || "https://api.kyve.network/"),
  "base-eth": new URL(
    process.env.BASE_ETH_GATEWAY || "https://mainnet.base.org"
  ),
};

const thirtyMinutesMs = 1000 * 60 * 30;
export const stripePaymentQuoteExpirationMs = +(
  process.env.TOP_UP_QUOTE_EXPIRATION_MS ?? thirtyMinutesMs
);

export const cryptoFundExcludedAddresses = process.env
  .CRYPTO_FUND_EXCLUDED_ADDRESSES
  ? process.env.CRYPTO_FUND_EXCLUDED_ADDRESSES.split(",")
  : [];
