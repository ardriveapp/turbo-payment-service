import { expect } from "chai";
import Knex from "knex";

import { expectedColumnInfo } from "../../tests/helpers/testExpectations";
import { listTables } from "../../tests/helpers/testHelpers";
import * as knexConfig from "./knexfile";
import { Schema } from "./schema";

/** Knex instance connected to a PostgreSQL database */
const knex = Knex(knexConfig);

describe("Schema class", () => {
  after(async function () {
    // Adjust timeout, this block sometimes takes longer than 3000ms during GitHub CI
    this.timeout(6_000);

    // Run a new schema create after the rollback test so database will be as expected for integration tests
    await Schema.create(knex);

    // Run integration tests after schema tests to avoid race conditions in the test env database
    // require("./postgres.spec");
  });

  it("after running latest knex migrations with knex CLI from docker-test.sh, all expected tables exists", async () => {
    const allTables = await listTables(knex);

    expect(allTables.rows.map((t) => t.table_name)).to.deep.equal([
      // Tables are returned alphabetized
      "chargeback_receipt",
      "knex_migrations",
      "knex_migrations_lock",
      "payment_receipt",
      "top_up_quote",
      "user",
    ]);
  });

  it("creates a `user` table that has the expected column structure", async () => {
    const columnInfo = await knex("user").columnInfo();
    expect(columnInfo).to.deep.equal({
      user_address,
      winston_credit_balance,
      promotional_info,
    });
  });

  it("creates a `top_up_quote` table that has the expected column structure", async () => {
    const columnInfo = await knex("top_up_quote").columnInfo();
    expect(columnInfo).to.deep.equal({
      top_up_quote_id,
      user_address,
      amount,
      currency_type,
      winston_credit_amount,
      quote_expiration_date,
      quote_creation_date,
      payment_provider,
    });
  });

  it("creates a `payment_receipt` table that has the expected column structure", async () => {
    const columnInfo = await knex("payment_receipt").columnInfo();
    expect(columnInfo).to.deep.equal({
      payment_receipt_id,
      payment_receipt_date,
      user_address,
      amount,
      currency_type,
      winston_credit_amount,
      top_up_quote_id,
      payment_provider,
    });
  });

  it("creates a `chargeback_receipt` table that has the expected column structure", async () => {
    const columnInfo = await knex("chargeback_receipt").columnInfo();
    expect(columnInfo).to.deep.equal({
      chargeback_receipt_id,
      payment_receipt_id,
      chargeback_receipt_date,
      user_address,
      amount,
      currency_type,
      winston_credit_amount,
      chargeback_reason,
      payment_provider,
    });
  });

  it("rollback schema public static method removes all expected tables", async () => {
    await Schema.rollback(knex);

    const allTables = await listTables(knex);

    expect(allTables.rows.map((t) => t.table_name)).to.deep.equal([
      "knex_migrations",
      "knex_migrations_lock",
    ]);
  });
});

const {
  amount,
  chargeback_reason,
  chargeback_receipt_date,
  chargeback_receipt_id,
  currency_type,
  payment_provider,
  payment_receipt_date,
  payment_receipt_id,
  top_up_quote_id,
  promotional_info,
  quote_creation_date,
  quote_expiration_date,
  user_address,
  winston_credit_amount,
  winston_credit_balance,
} = expectedColumnInfo;
