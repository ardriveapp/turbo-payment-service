import { ByteCount } from "./types/byteCount";
import { SupportedPaymentCurrencyTypes } from "./types/supportedCurrencies";

export const isTestEnv = process.env.NODE_ENV === "test";
export const defaultPort = +(process.env.PORT ?? 3000);
export const msPerMinute = 1000 * 60;
export const oneHourInSeconds = 3600;
export const oneMinuteInSeconds = 60;
export const paymentIntentTopUpMethod = "payment-intent";
export const checkoutSessionTopUpMethod = "checkout-session";

export const oneGiBInBytes = ByteCount(1024 * 1024 * 1024);
export const oneARInWinston = 1e12;
// the number of existing charge-backs recorded before we mark a wallet as fraudulent
export const maxAllowedChargebackDisputes = +(
  process.env.MAX_ALLOWED_CHARGE_BACKS ?? 1
);

export const topUpMethods = [
  paymentIntentTopUpMethod,
  checkoutSessionTopUpMethod,
] as const;

export const TEST_PRIVATE_ROUTE_SECRET = "test-secret";

export const turboFeePercentageAsADecimal = 0.23;

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

export const recognizedCountries = [
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
  "United Kingdom",
  "United States",
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
