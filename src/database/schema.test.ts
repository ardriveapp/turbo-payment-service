import { expect } from "chai";
import Knex from "knex";

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
      "price_quote",
      "user",
    ]);
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
