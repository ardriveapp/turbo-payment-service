/**
 * Copyright (C) 2022-2023 Permanent Data Solutions, Inc. All Rights Reserved.
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
import { AxiosResponseHeaders } from "axios";
import { expect } from "chai";

export function assertExpectedHeadersWithContentLength(
  headers: AxiosResponseHeaders,
  contentLength: number
) {
  expect(headers.date).to.exist;
  expect(headers).to.deep.include(
    expectedHeadersWithContentLength(contentLength)
  );
}

const expectedHeadersWithContentLength = (contentLength: number) => {
  // Headers without `date` for deep equality check
  // `date` value is not consistently predictable
  return {
    "content-type": "text/plain; charset=utf-8",
    "content-length": `${contentLength}`,
    connection: "close",
  };
};

const expectedDateColumn = (defaultValue = true) => {
  return {
    type: "timestamp with time zone",
    maxLength: null,
    nullable: false,
    defaultValue: defaultValue ? "CURRENT_TIMESTAMP" : null,
  };
};

const expectedVarCharColumn = ({
  length = 255,
  nullable = false,
  defaultValue = null,
}: {
  length?: number;
  nullable?: boolean;
  defaultValue?: null | string;
}) => {
  return {
    type: "character varying",
    maxLength: length,
    nullable,
    defaultValue,
  };
};

export const expectedColumnInfo = {
  user: {
    user_address: expectedVarCharColumn({}),
    user_address_type: expectedVarCharColumn({}),
    user_creation_date: expectedDateColumn(),
    winston_credit_balance: expectedVarCharColumn({}),
    promotional_info: {
      type: "jsonb",
      maxLength: null,
      nullable: false,
      defaultValue: "'{}'::jsonb",
    },
  },

  top_up_quote: {
    top_up_quote_id: expectedVarCharColumn({}),
    destination_address: expectedVarCharColumn({}),
    destination_address_type: expectedVarCharColumn({}),
    payment_amount: expectedVarCharColumn({}),
    currency_type: expectedVarCharColumn({}),
    winston_credit_amount: expectedVarCharColumn({}),
    quote_expiration_date: expectedDateColumn(false),
    quote_creation_date: expectedDateColumn(),
    payment_provider: expectedVarCharColumn({}),
  },

  failed_top_up_quote: {
    quote_creation_date: expectedDateColumn(false),

    failed_reason: expectedVarCharColumn({}),
    quote_failed_date: expectedDateColumn(),
  },

  payment_receipt: {
    quote_creation_date: expectedDateColumn(false),

    payment_receipt_id: expectedVarCharColumn({}),
    payment_receipt_date: expectedDateColumn(),
  },

  chargeback_receipt: {
    quote_creation_date: expectedDateColumn(false),
    payment_receipt_date: expectedDateColumn(false),

    chargeback_receipt_id: expectedVarCharColumn({}),
    chargeback_reason: expectedVarCharColumn({}),
    chargeback_receipt_date: expectedDateColumn(),
  },
};
