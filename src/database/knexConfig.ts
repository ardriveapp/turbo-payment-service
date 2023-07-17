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
  const dbPort = +(process.env.DB_PORT || 5432);
  const dbPassword = process.env.DB_PASSWORD || "postgres";

  return `postgres://postgres:${dbPassword}@${host}:${dbPort}/postgres?sslmode=disable`;
}

export function getWriterConfig() {
  const dbHost =
    process.env.DB_WRITER_ENDPOINT || process.env.DB_HOST || "127.0.0.1";
  return {
    ...baseConfig,
    connection: getDbConnection(dbHost),
  };
}

export function getReaderConfig() {
  const dbHost =
    process.env.DB_READER_ENDPOINT ||
    process.env.DB_WRITER_ENDPOINT ||
    process.env.DB_HOST ||
    "127.0.0.1";
  return {
    ...baseConfig,
    connection: getDbConnection(dbHost),
  };
}
