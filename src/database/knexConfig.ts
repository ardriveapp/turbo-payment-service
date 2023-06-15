// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import KnexDialect from "knex/lib/dialects/postgres";

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
  const dbHost =
    process.env.DB_WRITER_ENDPOINT || process.env.DB_HOST || "127.0.0.1";
  return {
    client: KnexDialect,
    version: "13.8",
    connection: getDbConnection(dbHost),
    migrations: {
      tableName: "knex_migrations",
      directory: "../../migrations",
    },
  };
}

export function getReaderConfig() {
  const dbHost =
    process.env.DB_READER_ENDPOINT ||
    process.env.DB_WRITER_ENDPOINT ||
    process.env.DB_HOST ||
    "127.0.0.1";
  return {
    ...getWriterConfig(),
    connection: getDbConnection(dbHost),
  };
}
