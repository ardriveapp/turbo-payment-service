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
export const supportedFiatPaymentCurrencyTypes = [
  "aud",
  "brl",
  "cad",
  "eur",
  "gbp",
  "hkd",
  "inr",
  "jpy",
  "sgd",
  "usd",
] as const;
export type SupportedFiatPaymentCurrencyType =
  (typeof supportedFiatPaymentCurrencyTypes)[number];

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
