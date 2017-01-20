#!/usr/bin/env bash

docker run -d -h mongo --volumes-from data-container --name mongo -p 27017:27017 mongo:3.2
