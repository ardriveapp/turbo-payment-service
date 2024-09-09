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
import { isDevEnv } from "../constants";
import {
  CreateNewCreditedTransactionParams,
  PendingPaymentTransaction,
} from "../database/dbTypes";
import globalLogger from "../logger";
import { baseAmountToTokenAmount, tokenExponentMap } from "../pricing/pricing";

export const slackChannels = {
  admin: process.env.SLACK_TURBO_ADMIN_CHANNEL_ID,
  topUp: process.env.SLACK_TURBO_TOP_UP_CHANNEL_ID,
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
