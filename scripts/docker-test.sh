#!/usr/bin/env sh

export NODE_ENV=test

# Runs a fresh PostgreSQL database in a docker test container
docker run --init --rm -d --name payment-service-postgres-test -v payment-service-test-data:/var/lib/postgresql/payment-service-test-data -p 54320:5432 -e POSTGRES_PASSWORD=localTestPassword -e PG_PORT=54320 postgres:13.8

set -e
EXIT_CODE=0

# run table migrations
yarn db:migrate:latest

# Add grep support for mocha tests
# e.g: `yarn docker-test "Database class"`
if [ -z "$1" ];
then yarn nyc mocha || EXIT_CODE=$?; 
else yarn nyc mocha -g "$1" || EXIT_CODE=$?; 
fi

# Teardown PostgreSQL test container and delete DB volume
docker stop payment-service-postgres-test
docker volume rm payment-service-test-data || echo "volume teardown failure";

exit $EXIT_CODE
