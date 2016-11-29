#!/bin/env bash

docker run -d -h mongo --name mongo -p 27017:27017 mongo:3.2
