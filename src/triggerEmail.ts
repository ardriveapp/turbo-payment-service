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
import { isGiftingEnabled } from "./constants";
import { UnredeemedGift } from "./database/dbTypes";
import { EmailProvider } from "./emailProvider";
import logger from "./logger";
import { MetricRegistry } from "./metricRegistry";

export async function triggerEmail(
  unredeemedGift: UnredeemedGift,
  emailProvider?: EmailProvider
): Promise<void> {
  try {
    if (!emailProvider) {
      throw Error(
        "Email provider is not defined! Cannot send gift redemption email!"
      );
    }

    if (!isGiftingEnabled) {
      throw Error("Gifting is not enabled! Cannot send gift redemption email!");
    }

    const {
      giftedWincAmount,
      paymentReceiptId,
      recipientEmail,
      giftMessage,
      senderEmail,
    } = unredeemedGift;

    await emailProvider.sendEmail({
      credits: (+giftedWincAmount / 1_000_000_000_000).toFixed(4),
      giftCode: paymentReceiptId,
      recipientEmail,
      giftMessage,
      senderEmail,
    });
  } catch (error) {
    MetricRegistry.giftEmailTriggerFailure.inc();
    logger.error("❌ Email sending has failed!", error, unredeemedGift);
  }
}
