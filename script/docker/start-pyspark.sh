#!/usr/bin/env bash

# run from project root
cd deploy/docker/pyspark-mongo-jupyter
docker run -d -p 8888:8888 --name pyspark-nb -e PYTHONPATH=/usr/local/spark/python:/usr/local/spark/python/lib/py4j-0.10.4-src.zip:/home/jovyan/work/util:/home/jovyan/work/app -e GRANT_SUDO=yes -e TINI_SUBREAPER=true --user root --net host --pid host -v `pwd`/app:/home/jovyan/work/app -v `pwd`/data:/home/jovyan/work/data -v `pwd`/nb:/home/jovyan/work/nb -v `pwd`/data:/home/jovyan/work/data -v `pwd`/../../../services/util:/home/jovyan/work/util sotera/pyspark-mongo-jupyter:2
