#!/bin/bash

DATABASE_URL=$(heroku config:get DATABASE_URL -a aiman-db)

export DATABASE_URL

node ./MT_BE/bin/www
