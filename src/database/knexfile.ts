import type { Knex } from "knex";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import KnexDialect from "knex/lib/dialects/postgres";

/** PostgreSQL port for test environment  */
const testEnvPort = 54320;

/** PostgreSQL port for local development environment and production */
const localEnvPort = 5432;

const dbHost = process.env.DB_HOST || "127.0.0.1";
const dbPort =
  process.env.DB_PORT || process.env.NODE_ENV === "test"
    ? testEnvPort
    : localEnvPort;
const dbPassword = process.env.DB_PASSWORD || "localTestPassword";

const dbConnection = `postgres://postgres:${dbPassword}@${dbHost}:${dbPort}/postgres?sslmode=disable`;

const config: Knex.Config = {
  client: KnexDialect,
  version: "13.8",
  connection: dbConnection,
  migrations: {
    tableName: "knex_migrations",
    directory: "../../migrations",
  },
};

module.exports = config;
