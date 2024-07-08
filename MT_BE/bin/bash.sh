#!/bin/bash

echo "Fetching DATABASE_URL from Heroku..."
DATABASE_URL=$(heroku config:get DATABASE_URL -a aiman-db)
echo "DATABASE_URL fetched: $DATABASE_URL"

echo "Exporting DATABASE_URL as environment variable..."
export DATABASE_URL

echo "Starting application..."
node ./MT_BE/bin/www &
APP_PID=$!


while kill -0 $APP_PID >/dev/null 2>&1; do
  echo "Application is running..."
  sleep 60
done

echo "Application stopped running."
