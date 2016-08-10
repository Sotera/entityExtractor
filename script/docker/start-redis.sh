#!/bin/env bash

docker stop redis
docker rm redis
docker run -d -p 6379:6379 --name redis redis
# for OSX
[ -f /usr/bin/docker-machine ] && redis-cli -h `docker-machine ip`
