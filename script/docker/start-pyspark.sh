#!/usr/bin/env bash

# default: run spark in local mode.
svc="pyspark-nb"

# if "cluster", start master, worker containers.
if [ "$1" == "cluster" ]; then
  svc=""
  echo "** You can run spark in local or cluster mode (spark://master:7077) **"
else
  echo "** You can run spark in local mode only **"
fi

cd deploy/docker/pyspark-mongo-jupyter
[ -d data ] || mkdir data
docker-compose -f docker-compose.notebook.yml up $svc
