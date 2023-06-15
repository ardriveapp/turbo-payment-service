// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import KnexDialect from "knex/lib/dialects/postgres";

const baseConfig = {
  client: KnexDialect,
  version: "13.8",
  migrations: {
    tableName: "knex_migrations",
    directory: "../../migrations",
  },
};

function getDbConnection(host: string) {
  /** PostgreSQL port for test environment  */
  const testEnvPort = 54320;

  /** PostgreSQL port for local development environment and production */
  const localEnvPort = 5432;

  const dbPort =
    process.env.DB_PORT || process.env.NODE_ENV === "test"
      ? testEnvPort
      : localEnvPort;
  const dbPassword = process.env.DB_PASSWORD || "localTestPassword";

  return `postgres://postgres:${dbPassword}@${host}:${dbPort}/postgres?sslmode=disable`;
}

export function getWriterConfig() {
  const dbHost = process.env.DB_WRITER_ENDPOINT || "127.0.0.1";
  return {
    ...baseConfig,
    connection: getDbConnection(dbHost),
  };
}

export function getReaderConfig() {
  const dbHost =
    process.env.DB_READER_ENDPOINT ||
    process.env.DB_WRITER_ENDPOINT ||
    "127.0.0.1";
  return {
    ...baseConfig,
    connection: getDbConnection(dbHost),
  };
}
