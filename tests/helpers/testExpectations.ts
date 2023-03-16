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
    type: "timestamp without time zone",
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
  winston_credit_balance: expectedVarCharColumn({}),
  last_payment_date: expectedDateColumn(),
  last_upload_date: expectedDateColumn(),
  promotional_info: {
    type: "jsonb",
    maxLength: null,
    nullable: false,
    defaultValue: "'{}'::jsonb",
  },
  price_quote_id: expectedVarCharColumn({}),
  usd_amount: expectedVarCharColumn({}),
  winston_credit_amount: expectedVarCharColumn({}),
  quote_expiration_date: expectedDateColumn(false),
  quote_creation_date: expectedDateColumn(),
  payment_provider: expectedVarCharColumn({}),
  payment_receipt_id: expectedVarCharColumn({}),
  payment_receipt_date: expectedDateColumn(),
  chargeback_receipt_id: expectedVarCharColumn({}),
  chargeback_reason: expectedVarCharColumn({}),
  chargeback_receipt_date: expectedDateColumn(),
};
