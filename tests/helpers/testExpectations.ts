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
  user_address: expectedVarCharColumn({}),
  user_address_type: expectedVarCharColumn({}),
  user_creation_date: expectedDateColumn(),
  destination_address: expectedVarCharColumn({}),
  destination_address_type: expectedVarCharColumn({}),
  winston_credit_balance: expectedVarCharColumn({}),
  promotional_info: {
    type: "jsonb",
    maxLength: null,
    nullable: false,
    defaultValue: "'{}'::jsonb",
  },
  top_up_quote_id: expectedVarCharColumn({}),
  amount: expectedVarCharColumn({}),
  currency_type: expectedVarCharColumn({}),
  winston_credit_amount: expectedVarCharColumn({}),
  quote_expiration_date: expectedDateColumn(false),
  quote_fulfilled_date: expectedDateColumn(),
  quote_failed_date: expectedDateColumn(),
  quote_creation_date: expectedDateColumn(),
  payment_provider: expectedVarCharColumn({}),
  payment_receipt_id: expectedVarCharColumn({}),
  payment_receipt_date: expectedDateColumn(),
  payment_receipt_rescinded_date: expectedDateColumn(),
  chargeback_receipt_id: expectedVarCharColumn({}),
  chargeback_reason: expectedVarCharColumn({}),
  chargeback_receipt_date: expectedDateColumn(),
};
