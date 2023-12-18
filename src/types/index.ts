/**
 * Copyright (C) 2022-2023 Permanent Data Solutions, Inc. All Rights Reserved.
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
export * from "./positiveFiniteInteger";
export * from "./equatable";
export * from "./ar";
export * from "./winston";
export * from "./arc";
export * from "./byteCount";

export type Base64URLString = string;
export type RSAModulusString = Base64URLString;
export type PublicKeyString = RSAModulusString; // TODO: add other supported public key types (ETH, SOL)
export type PublicArweaveAddress = Base64URLString;
export type TransactionId = Base64URLString;
