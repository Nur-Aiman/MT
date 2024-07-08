#!/bin/bash

# Fetch the latest DATABASE_URL
DATABASE_URL=$(heroku config:get DATABASE_URL -a aiman-db)

# Export it as an environment variable (useful for local development)
export DATABASE_URL

# Restart your application to pick up the new credentials (if necessary)
node ./bin/www
