import { Knex } from "knex";

import { Schema } from "../src/database/schema";

export async function up(knex: Knex): Promise<void> {
  return Schema.migrateAuditLogToPositiveNegativeCredits(knex);
}

export async function down(knex: Knex): Promise<void> {
  return Schema.rollBackFromMigrateAuditLogToPositiveNegativeCredits(knex);
}
