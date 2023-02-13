# Best Payment Service

Welcome to this payment service 👋

## Setting up the development environment

### System Package Installation

For a compatible development environment, we require the following packages installed on the system:

- `nvm`
- `yarn`
- `husky`
- `docker`

And for viewing and interacting with AWS infrastructure, these additional packages are also required:

- `aws`
- `terragrunt`
- `aws-vault`

### Running the Payment Service locally

With a compatible system, follow these steps to start the upload service:

- `yarn`
- `yarn build`
- `yarn db:up && yarn db:migrate:latest`
- `yarn start`

Developers can alternatively use `yarn start:watch` to run the app in development mode with hot reloading provided by `nodemon`

### Database Scripts

- `db:up`: Starts a local docker PostgreSQL container on port 5432
- `db:migrate:latest`: Runs migrations on a local PostgreSQL database
- `db:down`: Tears down local docker PostgreSQL container and deletes the db volume

## Docker Image

To build the container,

```shell
docker build --build-arg NODE_VERSION=$(cat .nvmrc |cut -c2-8) .
```
