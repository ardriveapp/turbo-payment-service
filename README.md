# Best Payment Service

Welcome to this payment service 👋

## Local Development

### Requirements

For a compatible development environment, we require the following packages installed on the system:

- `nvm`
- `yarn`
- `husky`
- `docker`

And for viewing and interacting with AWS infrastructure, these additional packages are also required:

- `aws`
- `terragrunt`
- `aws-vault`

### Running Locally

With a compatible system, follow these steps to start the upload service:

- `yarn`
- `yarn build`
- `yarn db:up`
- `yarn start`

Developers can alternatively use `yarn start:watch` to run the app in development mode with hot reloading provided by `nodemon`

### Docker

To run this service and a connected postgres database, fully migrated.

1. Update `.env` file with any desired environment variables
2. Run the container: `yarn start:docker`

To build the image:

```shell
docker build --build-arg NODE_VERSION=$(cat .nvmrc |cut -c2-8) --build-arg NODE_VERSION_SHORT=$(cat .nvmrc |cut -c2-3) .
```

## Database

The service relies on a postgres database. The following scripts can be used to create a local postgres database via docker:

- `yarn db:up`: Starts a local docker PostgreSQL container on port 5432
- `yarn db:migrate:latest`: Runs migrations on a local PostgreSQL database
- `yarn db:down`: Tears down local docker PostgreSQL container and deletes the db volume

### Migrations

Knex is used to create and run migrations. To make a migration follow these steps:

1. Add migration function and logic to `schema.ts`
2. Run the yarn command to stage the migration, which generates a new migration script in `migrations/` directory

- `yarn db:make:migration MIGRATION_NAME`

3. Update the new migration to call the static function created in step 1.

4. Run the migration

- `yarn db:migration:latest` or `yarn knex migration:up MIGRATION_NAME.TS`

### Rollbacks

You can rollback knex migrations using the following command:

- `yarn db:migrate:rollback` - rolls back the most recent migration
- `yarn db:migrate:rollback --all` - rolls back all migrations
- `yarn knex migrate:down MIGRATION_NAME.ts` - rolls back a specific migration

Additional `knex` documentation can be found [here](https://knexjs.org/guide/migrations.html).

## Tests

Unit and integration tests can be run locally or via docker. For either, you can set environment variables for the service via a `.env` file:

### Unit Tests

- `yarn test:unit` - runs unit tests locally

### Integration Tests

- `yarn test:integration:local` - runs the integration tests locally against postgres docker container
- `yarn test:integration:local -g "Router"` - runs targeted integration tests against postgres docker container
  - `watch -n 30 'yarn test:integration:local -g "Router'` - runs targeted integration tests on an interval (helpful when actively writing tests)
- `yarn test:docker` - runs integration tests (and unit tests) in an isolated docker container
