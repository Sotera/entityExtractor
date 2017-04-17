#!/usr/bin/env bash

cd deploy/docker/pyspark-mongo-jupyter
[ -d data ] || mkdir data
docker-compose -f docker-compose.notebook.mac.yml up
