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
import BigNumber from "bignumber.js";

import { isDevEnv } from "../constants";
import {
  ArNSPurchase,
  CreateNewCreditedTransactionParams,
  PendingPaymentTransaction,
} from "../database/dbTypes";
import globalLogger from "../logger";
import { baseAmountToTokenAmount, tokenExponentMap } from "../pricing/pricing";
import { winstonToCredits } from "../types";
import { zeroDecimalCurrencyTypes } from "../types/supportedCurrencies";

export const slackChannels = {
  admin: process.env.SLACK_TURBO_ADMIN_CHANNEL_ID,
  topUp: process.env.SLACK_TURBO_TOP_UP_CHANNEL_ID,
  arnsBuys: process.env.SLACK_TURBO_ARNS_BUYS_CHANNEL_ID,
};

export const sendSlackMessage = async ({
  message,
  channel = slackChannels.admin,
  username = "Payment Service",
  icon_emoji = ":moneybag:",
}: {
  message: string;
  channel?: string;
  username?: string;
  icon_emoji?: string;
}) => {
  try {
    globalLogger.debug(`sending slack message`, { message });
    const oAuthToken = process.env.SLACK_OAUTH_TOKEN;
    if (!oAuthToken || !channel) {
      throw new Error(
        "missing SLACK_OAUTH_TOKEN or SLACK_TURBO_ADMIN_CHANNEL_ID"
      );
    }
    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${oAuthToken}`,
      },
      body: JSON.stringify({
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: message,
            },
          },
        ],
        channel,
        username,
        icon_emoji,
      }),
    });
  } catch (error) {
    globalLogger.error(`slack message delivery failed`, error);
  }
};

export const sendCryptoFundSlackMessage = async ({
  destinationAddress,
  transactionId,
  transactionQuantity,
  tokenType,
  winstonCreditAmount,
  usdEquivalent,
}: (PendingPaymentTransaction | CreateNewCreditedTransactionParams) & {
  usdEquivalent: number;
}) => {
  const tokens = baseAmountToTokenAmount(
    transactionQuantity,
    tokenType
  ).toFixed(tokenExponentMap[tokenType]);
  const credits = baseAmountToTokenAmount(
    winstonCreditAmount.toString(),
    "arweave"
  ).toFixed(12);

  if (usdEquivalent < 5 && tokenType === "kyve") {
    // Don't send slack messages for kyve payments under $5
    globalLogger.info("Skipping slack message for kyve payment under $5", {
      usdEquivalent,
      tokenType,
      transactionId,
    });
    return;
  }

  if (isDevEnv) {
    // Don't send slack messages in dev env
    return;
  }

  return sendSlackMessage({
    channel: slackChannels.topUp,
    message: `New crypto payment credited:\`\`\`
Tokens: ${tokens} ${tokenType}
Credits: ${credits}
USD Equivalent: ${usdEquivalent === 0 ? "less than $0.01" : `$${usdEquivalent}`}
Address: ${destinationAddress}
TxID: ${transactionId}\`\`\``,
  });
};

export const sendArNSBuySlackMessage = async ({
  name,
  usdArRate,
  wincQty,
  paymentAmount,
  currencyType,
  promoCodes,
  mARIOQty,
  owner,
  type,
  years,
}: ArNSPurchase & { promoCodes: string[] }) => {
  if (isDevEnv) {
    // Don't send slack messages in dev env
    return;
  }
  let message = "New Turbo Registration!\n";

  message += `- Name: ${name}\n`;
  message += `- Type: ${type}${years ? ` for ${years} years` : ""}\n`;

  if (paymentAmount && currencyType) {
    // Was a Fiat purchase to stripe
    const payment = zeroDecimalCurrencyTypes.includes(currencyType)
      ? paymentAmount.toString()
      : // convert from 2 decimal currency
        (paymentAmount / 100).toFixed(2);
    message += `- Price: ${payment} ${currencyType.toUpperCase()} (${mARIOQty.toARIO()} $ARIO)\n`;
    if (promoCodes.length > 0) {
      message += `- Promo codes: ${promoCodes.join(", ")}\n`;
    }
  } else {
    // Was existing credit purchase
    const credits = winstonToCredits(wincQty);
    const usd = new BigNumber(credits).times(usdArRate).toFixed(2);
    message += `- Price: ${credits} Turbo credits ($${usd} USD or ${mARIOQty.toARIO()} $ARIO)\n`;
  }
  message += `- Owner: ${owner}\n`;

  return sendSlackMessage({
    channel: slackChannels.arnsBuys,
    message,
    icon_emoji: ":arns:",
  });
};
