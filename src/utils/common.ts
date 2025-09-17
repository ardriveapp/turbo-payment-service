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
import {
  ArNSPurchaseIntent,
  DelegatedPaymentApproval,
  validArNSPurchaseIntents,
} from "../database/dbTypes";
import { BadRequest } from "../database/errors";
import { W, Winston } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function filterKeysFromObject<T = any>(
  object: Record<string, T>,
  excludedKeys: string[]
): Record<string, T> {
  const entries = Object.entries(object);
  const filteredEntries = entries.filter(
    ([key]) => !excludedKeys.includes(key)
  );
  return Object.fromEntries(filteredEntries);
}

export function remainingWincAmountFromApprovals(
  approvals: DelegatedPaymentApproval[]
): Winston {
  const approvedAmount = approvals
    .map((a) => a.approvedWincAmount)
    .reduce((a, b) => a.plus(b), W(0));
  const usedAmount = approvals
    .map((a) => a.usedWincAmount)
    .reduce((a, b) => a.plus(b), W(0));

  return approvedAmount.minus(usedAmount);
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isValidArNSPurchaseIntent(
  intent: string
): intent is ArNSPurchaseIntent {
  return validArNSPurchaseIntents.includes(intent as ArNSPurchaseIntent);
}

export function formatRawIntent(
  intent: string | undefined
): ArNSPurchaseIntent {
  if (!intent || typeof intent !== "string") {
    throw new BadRequest("Missing required parameter: intent");
  }

  // make lowercase
  intent = intent
    .toLowerCase()
    .split("-")
    // capitalize first letter of each word
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("-");

  if (!isValidArNSPurchaseIntent(intent)) {
    throw new BadRequest("Invalid intent parameter");
  }
  return intent as ArNSPurchaseIntent;
}

type FormatStripeArNSPurchaseDescriptionParams = {
  intent: string;
  name: string;
  type?: string;
  years?: number;
  increaseQty?: number;
  processId?: string;
};

export function formatStripeArNSPurchaseDescription({
  intent,
  name,
  type,
  years,
  increaseQty,
  processId,
}: FormatStripeArNSPurchaseDescriptionParams): string {
  const parts = [
    `Intent: ${intent}`,
    `Name: ${name}`,
    type !== undefined ? `Type: ${type}` : null,
    years !== undefined ? `Years: ${years}` : null,
    increaseQty !== undefined ? `Increase Qty: ${increaseQty}` : null,
    processId !== undefined ? `Process Id: ${processId}` : null,
  ].filter(Boolean);

  return parts.join(", ");
}

type StripeMetadataInput = {
  adjustments: { name: string; adjustmentAmount: number | Winston }[];
  baseMetadata: Record<string, string | number | null>;
};

export function toStripeMetadata({
  adjustments,
  baseMetadata,
}: StripeMetadataInput): Record<string, string | number | null> {
  return adjustments.reduce(
    (acc, curr, i) => {
      // Add adjustments to stripe metadata
      // Stripe key name in metadata is limited to 40 characters, so we need to truncate the name.
      const keyName = `adj${i}_${curr.name}`.slice(0, 40);
      acc[keyName] = curr.adjustmentAmount.toString();
      return acc;
    },
    { ...baseMetadata } as Record<string, string | number | null>
  );
}
