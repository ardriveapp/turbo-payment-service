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
import { Mandrill } from "mandrill-api";
import winston from "winston";

import globalLogger from "./logger";

interface TemplateContent {
  credits: string;
  giftCode: string;
  recipientEmail: string;
  senderEmail?: string;
  giftMessage?: string;
}

export interface EmailProvider {
  sendEmail({
    credits,
    giftCode,
    recipientEmail,
    giftMessage,
    senderEmail,
  }: TemplateContent): Promise<void>;
}

export class MandrillEmailProvider implements EmailProvider {
  private readonly logger;
  private readonly mandrillClient: Mandrill;

  constructor(readonly apiKey: string, logger: winston.Logger = globalLogger) {
    this.mandrillClient = new Mandrill(apiKey);
    this.logger = logger.child({
      class: this.constructor.name,
    });
  }

  public async sendEmail({
    credits,
    giftCode,
    recipientEmail,
    giftMessage,
    senderEmail,
  }: TemplateContent): Promise<void> {
    const templateName = "gift-credits";
    const templateContent = [
      {
        name: "CREDITS",
        content: credits,
      },
      {
        name: "CODE",
        content: giftCode,
      },
      {
        name: "GIFTMESSAGE",
        content: giftMessage,
      },
      {
        name: "SENDEREMAIL",
        content: senderEmail,
      },
    ];

    try {
      const result = await this.mandrillClient.messages.sendTemplate({
        async: true,
        template_name: templateName,
        template_content: [],
        message: {
          to: [
            {
              email: recipientEmail,
              name: recipientEmail,
              type: "to",
            },
          ],
          global_merge_vars: templateContent,
        },
      });
      this.logger.info("Email sent successfully", result);
    } catch (error) {
      this.logger.error("Failed to send email via Mandrill!", error);
      throw error;
    }
  }
}
