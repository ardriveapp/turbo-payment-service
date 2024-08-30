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
import { Logger } from "winston";

import { Database } from "../database/database";
import { DestinationAddressType } from "../database/dbTypes";
import { PostgresDatabase } from "../database/postgres";
import { EmailProvider } from "../emailProvider";
import globalLogger from "../logger";
import { triggerEmail } from "../triggerEmail";
import { wincFromCredits } from "../types";
import { sendSlackMessage } from "../utils/slack";

/**
 * Admin tool for adding credits to a list of email or wallet addresses
 */
export async function addCreditsToAddresses({
  logger = globalLogger.child({ job: "addCreditsToAddresses" }),
  paymentDatabase = new PostgresDatabase(),
  emailProvider,
  addresses,
  addressType = "arweave",
  creditAmount = 1,
  giftMessage,
}: {
  logger?: Logger;
  paymentDatabase?: Database;
  emailProvider?: EmailProvider;
  addresses: string[];
  addressType?: DestinationAddressType;
  creditAmount?: number;
  giftMessage?: string;
}): Promise<void> {
  logger.info("Adding credits to addresses", {
    addresses,
    creditAmount,
    addressType,
  });

  const winc = wincFromCredits(creditAmount);

  const unredeemedGifts = await paymentDatabase.createBypassedPaymentReceipts(
    addresses.map((address) => ({
      currencyType: "winc",
      destinationAddress: address,
      destinationAddressType: addressType,
      paymentAmount: 0, // admin add, no money paid
      paymentProvider: "admin",
      winc,
      giftMessage,
    }))
  );

  for (const unredeemedGift of unredeemedGifts) {
    await triggerEmail(unredeemedGift, emailProvider);
  }

  await sendSlackMessage({
    message: `Added ${creditAmount} Turbo Credit(s) to the following addresses:\n\`\`\`${addresses.map(
      (address) => `\n${address}`
    )}\`\`\``,
  });
}
