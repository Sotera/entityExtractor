#!/usr/bin/env bash

if [ -z "$1" ]; then
  echo "missing arg: path/to/db/dump/file"
  exit 1
fi

set -x
# Reset collections, load posts from db dump, clear redis keys, rm downloaded image files
mongo --host mongo rancor --eval "db.dropDatabase()"
mongorestore -d rancor --gzip --numInsertionWorkersPerCollection=8 --drop --archive=$1
redis-cli -h redis flushall
sudo rm -rf /downloads/image-fetcher
