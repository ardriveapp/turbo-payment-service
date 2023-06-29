import { expect } from "chai";
import Knex from "knex";

import * as knexConfig from "../src/database/knexfile";
import { Schema } from "../src/database/schema";
import { expectedColumnInfo } from "./helpers/testExpectations";
import { listTables } from "./helpers/testHelpers";

/** Knex instance connected to a PostgreSQL database */
const knex = Knex(knexConfig);

describe("Schema class", () => {
  after(async function () {
    // Adjust timeout, this block sometimes takes longer than 3000ms during GitHub CI
    this.timeout(6_000);

    // Run a new schema create after the rollback test so database will be as expected for integration tests
    await Schema.create(knex);
  });

  it("after running latest knex migrations with knex CLI from docker-test.sh, all expected tables exists", async () => {
    const allTables = await listTables(knex);

    expect(allTables.rows.map((t) => t.table_name)).to.deep.equal([
      // Tables are returned alphabetized
      "chargeback_receipt",
      "failed_top_up_quote",
      "knex_migrations",
      "knex_migrations_lock",
      "payment_receipt",
      "top_up_quote",
      "user",
    ]);
  });

  it("creates a `user` table that has the expected column structure", async () => {
    const columnInfo = await knex("user").columnInfo();
    expect(columnInfo).to.deep.equal(expectedColumnInfo.user);
  });

  it("creates a `top_up_quote` table that has the expected column structure", async () => {
    const columnInfo = await knex("top_up_quote").columnInfo();
    expect(columnInfo).to.deep.equal(expectedColumnInfo.top_up_quote);
  });

  it("creates a `failed_top_up_quote` table that has the expected column structure", async () => {
    const columnInfo = await knex("failed_top_up_quote").columnInfo();
    expect(columnInfo).to.deep.equal({
      ...expectedColumnInfo.top_up_quote,
      ...expectedColumnInfo.failed_top_up_quote,
    });
  });

  it("creates a `payment_receipt` table that has the expected column structure", async () => {
    const columnInfo = await knex("payment_receipt").columnInfo();
    expect(columnInfo).to.deep.equal({
      ...expectedColumnInfo.top_up_quote,
      ...expectedColumnInfo.payment_receipt,
    });
  });

  it("creates a `chargeback_receipt` table that has the expected column structure", async () => {
    const columnInfo = await knex("chargeback_receipt").columnInfo();
    expect(columnInfo).to.deep.equal({
      ...expectedColumnInfo.top_up_quote,
      ...expectedColumnInfo.payment_receipt,
      ...expectedColumnInfo.chargeback_receipt,
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
