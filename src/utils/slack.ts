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
import globalLogger from "../logger";

export const sendSlackMessage = async ({
  message,
  channel = process.env.SLACK_TURBO_ADMIN_CHANNEL_ID,
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
