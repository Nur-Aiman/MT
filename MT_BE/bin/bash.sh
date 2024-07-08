#!/bin/bash

echo "Fetching DATABASE_URL from Heroku..."
DATABASE_URL=$(heroku config:get DATABASE_URL -a aiman-db)
echo "DATABASE_URL fetched: $DATABASE_URL"

echo "Exporting DATABASE_URL as environment variable..."
export DATABASE_URL

echo "Setup tasks completed."
