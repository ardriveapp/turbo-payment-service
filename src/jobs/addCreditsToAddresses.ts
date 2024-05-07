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
import { EmailProvider, MandrillEmailProvider } from "../emailProvider";
import globalLogger from "../logger";
import { triggerEmail } from "../triggerEmail";
import { wincFromCredits } from "../types";
import { loadSecretsToEnv } from "../utils/loadSecretsToEnv";

/**
 * Admin tool for adding credits to a list of email or wallet addresses
 */
export async function addCreditsToAddresses({
  logger = globalLogger.child({ job: "addCreditsToAddresses" }),
  paymentDatabase = new PostgresDatabase(),
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  emailProvider = new MandrillEmailProvider(process.env.MANDRILL_API_KEY!),
  addresses,
  addressType = "email",
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
}

export async function handler({
  addresses,
  creditAmount,
  addressType,
  giftMessage,
}: {
  addresses: string[];
  giftMessage?: string;
  addressType?: DestinationAddressType;
  creditAmount: number;
}) {
  await loadSecretsToEnv();
  // TODO: SQS Queue Handler -> Event -> Message -> Body
  return addCreditsToAddresses({
    addresses,
    creditAmount,
    addressType,
    giftMessage,
  });
}

// To Credit Email Addresses with 1 Credit each:
// - Supply env vars for DB_HOST,DB_PASSWORD,MANDRILL_API_KEY and set GIFTING_ENABLED=true
// - Supply CSV email list at ADDRESSES env var
// - Uncomment the following code
// - Run `yarn ts-node src/jobs/addCreditsToAddresses.ts`
// void (async () => {
//   await loadSecretsToEnv();
//   await addCreditsToAddresses({
//     addresses: process.env.ADDRESSES!.split(","), // eslint-disable-line @typescript-eslint/no-non-null-assertion
//     giftMessage: "Thank you for visiting us at ETH Denver!",
//   });
// })();
