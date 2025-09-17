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
import validator from "validator";

import {
  StripePaymentMethod,
  maxGiftMessageLength,
  stripePaymentMethods,
} from "../constants";
import {
  ArNSNameType,
  ArNSPurchaseParams,
  ArNSTokenCostParams,
  DataItemId,
  DestinationAddressType,
  PaymentDirective,
  UserAddress,
  UserAddressType,
  destinationAddressTypes,
  isPaymentDirective,
  paymentDirectives,
  userAddressTypes,
} from "../database/dbTypes";
import { BadQueryParam, BadRequest, Unauthorized } from "../database/errors";
import { MetricRegistry } from "../metricRegistry";
import { KoaContext } from "../server";
import { ByteCount, W, Winston } from "../types";
import {
  SupportedFiatPaymentCurrencyType,
  supportedFiatPaymentCurrencyTypes,
} from "../types/supportedCurrencies";
import {
  isAnyValidUserAddress,
  isValidArweaveBase64URL,
  isValidUserAddress,
} from "./base64";
import { formatRawIntent } from "./common";

/** Returns true if these given query parameters are strings */
export function validateQueryParameters(
  ctx: KoaContext,
  queryParameters: (string | string[] | undefined)[]
): queryParameters is string[] {
  if (
    queryParameters.some((parameter) => !parameter) ||
    queryParameters.some(Array.isArray)
  ) {
    ctx.response.status = 400;
    ctx.body = "Invalid or missing parameters";
    ctx.state.logger.error("Invalid parameters provided for route!", {
      query: ctx.query,
      params: ctx.params,
    });
    return false;
  }
  return true;
}

export function validateAuthorizedRoute(ctx: KoaContext): boolean {
  if (!ctx.request.headers.authorization || !ctx.state.user) {
    ctx.response.status = 401;
    ctx.body = "Unauthorized";
    ctx.state.logger.error(
      "No authorization or user provided for authorized route!",
      {
        user: ctx.state.user,
        headers: ctx.request.headers,
      }
    );
    MetricRegistry.unauthorizedProtectedRouteActivity.inc();
    return false;
  }
  return true;
}

export function assertAuthorizedRoute(ctx: KoaContext): void {
  if (!ctx.request.headers.authorization || !ctx.state.user) {
    ctx.state.logger.error(
      "No authorization or user provided for authorized route!",
      {
        user: ctx.state.user,
        headers: ctx.request.headers,
      }
    );
    MetricRegistry.unauthorizedProtectedRouteActivity.inc();
    throw new Unauthorized();
  }
}

export function validateByteCount(
  ctx: KoaContext,
  stringByteCount: string
): ByteCount | false {
  try {
    return ByteCount(+stringByteCount);
  } catch (error) {
    ctx.response.status = 400;
    ctx.body = `Invalid parameter for byteCount: ${stringByteCount}`;
    ctx.state.logger.error("Invalid byte count!", {
      ...ctx.params,
      ...ctx.query,
      error,
    });
    return false;
  }
}

export function validateWinstonCreditAmount(
  ctx: KoaContext,
  stringWinstonCreditAmount: string
): Winston | false {
  try {
    return new Winston(+stringWinstonCreditAmount);
  } catch (error) {
    ctx.response.status = 400;
    ctx.body = `Invalid value provided for winstonCredits: ${stringWinstonCreditAmount}`;
    ctx.state.logger.error("Invalid winston credit amount!", {
      ...ctx.params,
      ...ctx.query,
      error,
    });
    return false;
  }
}

export function validateSingularQueryParameter(
  ctx: KoaContext,
  queryParameter: string | string[] | undefined
): string | false {
  if (
    !queryParameter ||
    (Array.isArray(queryParameter) && queryParameter.length > 1)
  ) {
    ctx.response.status = 400;
    ctx.body = "Invalid or missing parameters";
    ctx.state.logger.error("Invalid parameters provided for route!", {
      query: ctx.query,
      params: ctx.params,
    });
    return false;
  }

  return Array.isArray(queryParameter) ? queryParameter[0] : queryParameter;
}

function isDestinationAddressType(
  destinationAddressType: string
): destinationAddressType is DestinationAddressType {
  return destinationAddressTypes.includes(
    destinationAddressType as DestinationAddressType
  );
}

export function validateDestinationAddressType(
  ctx: KoaContext,
  destinationAddressType: string | string[] | undefined
): DestinationAddressType | false {
  if (destinationAddressType === undefined) {
    return "arweave";
  }

  const destType = validateSingularQueryParameter(ctx, destinationAddressType);

  if (!destType || !isDestinationAddressType(destType)) {
    ctx.response.status = 400;
    ctx.body = `Invalid destination address type: ${destType}`;
    ctx.state.logger.error("Invalid destination address type!", {
      ...ctx.params,
      ...ctx.query,
    });
    return false;
  }

  return destType;
}

function isValidUserAddressType(
  userAddressType: string
): userAddressType is UserAddressType {
  return userAddressTypes.includes(userAddressType as UserAddressType);
}

export function validateUserAddressType(
  ctx: KoaContext,
  userAddressType: string | string[]
): UserAddressType | false {
  const addressType = validateSingularQueryParameter(ctx, userAddressType);

  if (!addressType || !isValidUserAddressType(addressType)) {
    ctx.response.status = 400;
    ctx.body = `Invalid user address type: ${addressType}`;
    ctx.state.logger.error("Invalid user address type!", {
      ...ctx.params,
      ...ctx.query,
    });
    return false;
  }

  return addressType;
}

export function validateGiftMessage(
  ctx: KoaContext,
  giftMessage: string | string[]
): string | false {
  const message = validateSingularQueryParameter(ctx, giftMessage);

  if (!message || message.length > maxGiftMessageLength) {
    ctx.response.status = 400;
    ctx.body = "Invalid gift message!";
    ctx.state.logger.error("Invalid gift message!", {
      query: ctx.query,
      params: ctx.params,
    });
    return false;
  }

  return validator.escape(message);
}

export const uiModes = ["hosted", "embedded"] as const;
export type UiMode = (typeof uiModes)[number];
function isUiMode(uiMode: string): uiMode is UiMode {
  return uiModes.includes(uiMode as UiMode);
}

function assertSingleParam(queryParam: QueryParam): string | undefined {
  if (Array.isArray(queryParam)) {
    if (queryParam.length > 1) {
      throw new BadQueryParam(
        `Expected a singular query parameter but got an array ${queryParam}`
      );
    }
    return queryParam[0];
  }
  return queryParam;
}

function assertUiMode(uiMode: QueryParam): UiMode {
  const mode = assertSingleParam(uiMode);

  if (mode) {
    if (!isUiMode(mode)) {
      throw new BadQueryParam(
        `Invalid ui mode! Allowed modes: "${uiModes.toString()}"`
      );
    }
    return mode;
  }

  return "hosted";
}

function assertUrl(url: QueryParam): string | undefined {
  const u = assertSingleParam(url);

  if (u && !validator.isURL(u)) {
    throw new BadQueryParam(`Invalid url provided: ${u}!`);
  }
  return u;
}

type QueryParam = undefined | string | string[];
export function assertUiModeAndUrls({
  cancelUrl,
  returnUrl,
  successUrl,
  uiMode,
}: {
  returnUrl: QueryParam;
  cancelUrl: QueryParam;
  successUrl: QueryParam;
  uiMode: QueryParam;
}): StripeUiModes {
  const mode = assertUiMode(uiMode);
  if (mode === "hosted") {
    const success = assertUrl(successUrl) ?? undefined;
    const cancel = assertUrl(cancelUrl) ?? undefined;
    return {
      uiMode: "hosted",
      successUrl: success,
      cancelUrl: cancel,
    };
  }
  const retUrl = assertUrl(returnUrl);
  return {
    uiMode: "embedded",
    returnUrl: retUrl,
  };
}

export function getValidatedCreateApprovalParams(ctx: KoaContext): {
  payingAddress: UserAddress;
  approvedWincAmount: Winston;
  approvalDataItemId: DataItemId;
  approvedAddress: UserAddress;
  expiresInSeconds?: number;
} {
  const { winc: rawWincAmount, expiresInSeconds: rawExpirationSeconds } =
    ctx.query;

  const { payingAddress, approvedAddress } = getValidatedApprovalParams(ctx);
  const approvalDataItemId = validatedDataItemId(ctx);

  if (!rawWincAmount || Array.isArray(rawWincAmount)) {
    throw new BadRequest(
      "Missing or malformed required query parameters:  wincAmount"
    );
  }

  let winc: Winston;
  try {
    winc = W(rawWincAmount);
  } catch (error) {
    throw new BadRequest(
      `Invalid value provided for wincAmount: ${rawWincAmount}\n${
        error instanceof Error ? error.message : error
      }`
    );
  }

  let expiresInSeconds: number | undefined = undefined;

  if (rawExpirationSeconds) {
    try {
      if (Array.isArray(rawExpirationSeconds)) {
        throw new Error("Expected a singular query parameter but got an array");
      }

      expiresInSeconds = +rawExpirationSeconds;

      if (expiresInSeconds < 0 || !Number.isInteger(expiresInSeconds)) {
        throw new Error("Must be a positive integer");
      }
    } catch (error) {
      throw new BadRequest(
        `Invalid value provided for expiresInSeconds: ${rawExpirationSeconds}\n${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }

  return {
    payingAddress,
    approvalDataItemId,
    approvedWincAmount: winc,
    approvedAddress,
    expiresInSeconds,
  };
}

export function getValidatedApprovalParams(ctx: KoaContext): {
  payingAddress: UserAddress;
  approvedAddress: UserAddress;
} {
  const {
    payingAddress: rawPayingAddress,
    approvedAddress: rawApprovedAddress,
  } = ctx.query;

  if (
    !rawPayingAddress ||
    !rawApprovedAddress ||
    Array.isArray(rawPayingAddress) ||
    Array.isArray(rawApprovedAddress)
  ) {
    throw new BadRequest(
      "Malformed or missing required query parameters: payingAddress, approvedAddress"
    );
  }

  if (!isAnyValidUserAddress(rawPayingAddress)) {
    throw new BadRequest("Invalid paying address");
  } else if (!isAnyValidUserAddress(rawApprovedAddress)) {
    throw new BadRequest("Invalid approved address");
  }

  return {
    payingAddress: rawPayingAddress,
    approvedAddress: rawApprovedAddress,
  };
}

function validatedDataItemId(ctx: KoaContext): DataItemId {
  const { dataItemId: rawDataItemId } = ctx.query;

  if (!rawDataItemId || Array.isArray(rawDataItemId)) {
    throw new BadRequest(
      "Malformed or missing required query parameter: dataItemId"
    );
  }

  if (!isValidArweaveBase64URL(rawDataItemId)) {
    throw new BadRequest("Invalid dataItemId provided!");
  }

  return rawDataItemId;
}

export function getValidatedRevokeApprovalParams(ctx: KoaContext): {
  payingAddress: UserAddress;
  approvedAddress: UserAddress;
  revokeDataItemId: DataItemId;
} {
  return {
    ...getValidatedApprovalParams(ctx),
    revokeDataItemId: validatedDataItemId(ctx),
  };
}

export function getValidatedGetApprovalParams(ctx: KoaContext): {
  approvedAddress: UserAddress;
  payingAddress: UserAddress;
} {
  return getValidatedApprovalParams(ctx);
}

export function getValidatedGetAllApprovalParams(ctx: KoaContext): {
  userAddress: UserAddress;
} {
  const { userAddress: rawUserAddress } = ctx.query;

  if (!rawUserAddress || Array.isArray(rawUserAddress)) {
    throw new BadRequest(
      "Malformed or missing required query parameter: userAddress"
    );
  }

  if (!isAnyValidUserAddress(rawUserAddress)) {
    throw new BadRequest("Invalid user address");
  }

  return {
    userAddress: rawUserAddress,
  };
}

function validatedSignerAddressAndToken(ctx: KoaContext): {
  signerAddress: UserAddress;
  signerAddressType: UserAddressType;
} {
  const { signerAddress, token: signerAddressType } = ctx.params;

  if (!signerAddress) {
    throw new BadRequest("Missing required parameter: walletAddress");
  }

  if (!isValidUserAddressType(signerAddressType)) {
    throw new BadRequest(
      "Invalid token type. Try one of these: " + userAddressTypes
    );
  }

  if (!isValidUserAddress(signerAddress, signerAddressType)) {
    throw new BadRequest(
      "Invalid wallet address for token type " + signerAddressType
    );
  }

  return {
    signerAddress,
    signerAddressType,
  };
}

function validatedPaidBy(ctx: KoaContext): UserAddress[] {
  const { paidBy: rawPaidBy } = ctx.query;

  let paidBy: string[] = [];
  if (rawPaidBy !== undefined) {
    if (Array.isArray(rawPaidBy)) {
      paidBy = rawPaidBy.filter(isAnyValidUserAddress);
    } else if (isAnyValidUserAddress(rawPaidBy)) {
      paidBy = [rawPaidBy];
    } else {
      // If it's a string that is not an address, we can split it by commas and try those
      const splitPaidBys = rawPaidBy.split(",");
      paidBy = splitPaidBys.filter(isAnyValidUserAddress);
    }
  }
  return paidBy;
}

function validatedByteCount(ctx: KoaContext): ByteCount {
  const { byteCount: rawByteCount } = ctx.query;
  if (rawByteCount === undefined || typeof rawByteCount !== "string") {
    throw new BadRequest("Missing required parameter: byteCount");
  }

  let byteCount: ByteCount;
  try {
    byteCount = ByteCount(+rawByteCount);
  } catch (error) {
    throw new BadRequest(
      `Invalid parameter for byteCount: ${rawByteCount}\n${
        error instanceof Error ? error.message : error
      }`
    );
  }

  return byteCount;
}

export function getValidatedReserveBalanceParams(ctx: KoaContext): {
  signerAddress: UserAddress;
  signerAddressType: UserAddressType;
  byteCount: ByteCount;
  dataItemId: DataItemId;
  paidBy: UserAddress[];
  paymentDirective: PaymentDirective;
} {
  assertAuthorizedRoute(ctx);

  const { paymentDirective: rawPaymentDirective = "list-or-signer" } =
    ctx.query;

  if (
    Array.isArray(rawPaymentDirective) ||
    !isPaymentDirective(rawPaymentDirective)
  ) {
    throw new BadRequest(
      "Invalid payment directive. Try one of these: " + paymentDirectives
    );
  }

  return {
    ...validatedSignerAddressAndToken(ctx),
    byteCount: validatedByteCount(ctx),
    dataItemId: validatedDataItemId(ctx),
    paidBy: validatedPaidBy(ctx),
    paymentDirective: rawPaymentDirective,
  };
}

export function getValidatedCheckBalanceParams(ctx: KoaContext): {
  signerAddress: UserAddress;
  byteCount: ByteCount;
  paidBy: UserAddress[];
} {
  assertAuthorizedRoute(ctx);

  return {
    ...validatedSignerAddressAndToken(ctx),
    byteCount: validatedByteCount(ctx),
    paidBy: validatedPaidBy(ctx),
  };
}

export function getValidatedArNSPriceParams(
  ctx: KoaContext
): ArNSTokenCostParams & {
  currency?: SupportedFiatPaymentCurrencyType;
  userAddress?: UserAddress;
} {
  const { name, intent: rawIntent } = ctx.params;
  const {
    years: rawYears,
    increaseQty: rawIncreaseQty,
    type: rawType,
    currency: rawCurrency,
    userAddress: rawUserAddress,
  } = ctx.query;

  if (!name || typeof name !== "string") {
    throw new BadRequest("Missing required parameter: name");
  }
  if (name.length > 51) {
    throw new BadRequest("Name must be less than 51 characters");
  }

  const intent = formatRawIntent(rawIntent);

  let years: number | undefined = undefined;
  if (rawYears !== undefined) {
    years = Array.isArray(rawYears) ? +rawYears[0] : +rawYears;
    if (isNaN(years)) {
      throw new BadRequest("Invalid years parameter");
    }
  }

  let increaseQty: number | undefined = undefined;
  if (rawIncreaseQty !== undefined) {
    increaseQty = Array.isArray(rawIncreaseQty)
      ? +rawIncreaseQty[0]
      : +rawIncreaseQty;
    if (isNaN(increaseQty)) {
      throw new BadRequest("Invalid increaseQty parameter");
    }
  }

  let type: ArNSNameType | undefined = undefined;
  if (rawType !== undefined) {
    const t = Array.isArray(rawType) ? rawType[0] : rawType;
    if (!["permabuy", "lease"].includes(t)) {
      throw new BadRequest("Invalid ArNS type parameter");
    }
    type = t as ArNSNameType;
  }

  let currency: SupportedFiatPaymentCurrencyType | undefined = undefined;
  if (rawCurrency !== undefined) {
    const c = Array.isArray(rawCurrency) ? rawCurrency[0] : rawCurrency;
    if (
      !supportedFiatPaymentCurrencyTypes.includes(
        c as SupportedFiatPaymentCurrencyType
      )
    ) {
      throw new BadRequest("Invalid currency type");
    }
    currency = c as SupportedFiatPaymentCurrencyType;
  }

  let userAddress: UserAddress | undefined = undefined;
  if (rawUserAddress !== undefined) {
    const u = Array.isArray(rawUserAddress)
      ? rawUserAddress[0]
      : rawUserAddress;

    if (!isAnyValidUserAddress(u)) {
      throw new BadRequest("Invalid user address");
    }
    userAddress = u;
  }

  return {
    name: name.toLowerCase(),
    intent,
    years,
    increaseQty,
    type,
    currency,
    userAddress,
  };
}

export function getValidatedArNSPurchaseParams(
  ctx: KoaContext,
  assertIsSignedRequest = true
): Omit<
  ArNSPurchaseParams,
  "wincQty" | "mARIOQty" | "usdArRate" | "usdArioRate" | "messageId"
> {
  const priceParams = getValidatedArNSPriceParams(ctx);

  const { processId: rawProcessId } = ctx.query;

  const paidBy = validatedPaidBy(ctx);

  const owner = ctx.state.walletAddress;
  const nonce = ctx.state.nonce;

  if (assertIsSignedRequest) {
    if (!owner || typeof owner !== "string") {
      throw new Unauthorized("Signed request is required for this route");
    }

    if (!nonce || typeof nonce !== "string") {
      throw new BadRequest("Missing required parameter: nonce");
    }

    if (!validator.isUUID(nonce) || nonce.length > 64) {
      throw new BadRequest(
        "Invalid nonce parameter. Nonce must be a UUID for signed write actions"
      );
    }
  }

  let processId: string | undefined = undefined;
  if (rawProcessId !== undefined) {
    processId = Array.isArray(rawProcessId) ? rawProcessId[0] : rawProcessId;
  }

  const { intent, type, years, increaseQty } = priceParams;
  if (intent === "Buy-Name") {
    if (processId === undefined) {
      throw new BadRequest("Missing required parameter: processId");
    }
    if (type === undefined || (type !== "permabuy" && type !== "lease")) {
      throw new BadRequest(
        "Missing required parameter: type. Must be either 'permabuy' or 'lease'"
      );
    }
  } else if (intent === "Extend-Lease") {
    if (years === undefined) {
      throw new BadRequest("Missing required parameter: years");
    }
  } else if (intent === "Increase-Undername-Limit") {
    if (increaseQty === undefined) {
      throw new BadRequest("Missing required parameter: increaseQty");
    }
  }

  return {
    ...priceParams,
    owner,
    nonce,
    processId,
    paidBy,
  };
}

type StripeUiModes =
  | {
      uiMode: "hosted";
      successUrl: string | undefined;
      cancelUrl: string | undefined;
    }
  | { uiMode: "embedded"; returnUrl: string | undefined };

export function getValidatedArNSPurchaseQuoteParams(ctx: KoaContext): Omit<
  ArNSPurchaseParams,
  | "wincQty"
  | "mARIOQty"
  | "usdArRate"
  | "usdArioRate"
  | "nonce"
  | "owner"
  | "messageId"
> & {
  currency: SupportedFiatPaymentCurrencyType;
  method: StripePaymentMethod;
  destinationAddress: UserAddress;
} & StripeUiModes {
  const purchaseParams = getValidatedArNSPurchaseParams(ctx, false);
  const { currency, method, address } = ctx.params;

  if (!stripePaymentMethods.includes(method)) {
    throw new BadRequest(
      `Invalid payment method. Allowed methods: ${stripePaymentMethods}`
    );
  }

  if (!isAnyValidUserAddress(address)) {
    throw new BadRequest("Invalid destination address");
  }

  if (!supportedFiatPaymentCurrencyTypes.includes(currency)) {
    throw new BadRequest(
      `Invalid currency type. Allowed types: ${supportedFiatPaymentCurrencyTypes}`
    );
  }

  const uiModeParams = assertUiModeAndUrls({
    returnUrl: ctx.query.returnUrl,
    cancelUrl: ctx.query.cancelUrl,
    successUrl: ctx.query.successUrl,
    uiMode: ctx.query.uiMode,
  });

  return {
    ...purchaseParams,
    ...uiModeParams,
    method: method as StripePaymentMethod,
    currency: currency as SupportedFiatPaymentCurrencyType,
    destinationAddress: address,
  };
}
