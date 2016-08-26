# Watchman

## What is it?

A core set of utilities frequently used in large data processing / ML projects, exposed as REST endpoints. Want to extract text from HTML?... we've got it. Caption a set of images scraped from the web?... this is your place. Extract entities with MITIE or Stanford NER. Yes please.

## Dependencies

1. Node 4
1. Strongloop 2
1. Bower
1. Docker 1.9+ / Firmament2
1. Mongo 2.6
1. Redis 3

## Install

```
# get working copy of .env file from a friend
npm i -g strongloop bower
npm i
# only if models change...
lb-ng server/server.js client/js/lb-services.js
```

## Dev boostrap

```
# get working copy of .env
./script/setup.js
npm run dev # open localhost:3000

# to process job monitors, in another terminal:
WORKER_SCRIPT=./workers/job-queue npm run dev
```

## Misc

```
# build mitie-server image
git clone lukewendling/mitie-server
docker build --no-cache --force-rm -t lukewendling/mitie-server .

docker run -d -p 8888:8888 --name mitie lukewendling/mitie-server
./server/workers/start-extractor.js # start workers
```
