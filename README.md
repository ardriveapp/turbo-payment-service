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

## Tests

Unit and integration tests can be run locally or via docker. For either, you can set environment variables for the service via a `.env` file:

### Unit Tests

- `yarn test:unit` - runs unit tests locally

### Integration Tests

- `yarn test:integration:local` - runs the integration tests locally against postgres docker container

- `yarn test:docker` - runs integration tests (and unit tests) in an isolated docker container
