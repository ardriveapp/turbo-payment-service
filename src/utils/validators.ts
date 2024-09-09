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

import { defaultCheckoutSuccessUrl, maxGiftMessageLength } from "../constants";
import {
  DestinationAddressType,
  UserAddressType,
  destinationAddressTypes,
  userAddressTypes,
} from "../database/dbTypes";
import { BadQueryParam } from "../database/errors";
import { MetricRegistry } from "../metricRegistry";
import { KoaContext } from "../server";
import { ByteCount, Winston } from "../types";

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
}):
  | { uiMode: "hosted"; successUrl: string; cancelUrl: string | undefined }
  | { uiMode: "embedded"; returnUrl: string | undefined } {
  const mode = assertUiMode(uiMode);
  if (mode === "hosted") {
    const success = assertUrl(successUrl) ?? defaultCheckoutSuccessUrl;
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
