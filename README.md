# Watchman

## What is it?

A core set of utilities frequently used in large data processing / ML projects, exposed as REST endpoints. Want to extract text from HTML?... we've got it. Caption a set of images scraped from the web?... this is your place. Extract entities with MITIE or Stanford NER. Yes please.

## Dependencies

1. Node 4
1. Strongloop 2
1. Bower
1. Docker 1.12
1. Python 2.7 + 3.5

## Dev boostrap

```
# get working copy of .env file from a friend
npm i -g strongloop bower
npm i
# only if models change...
lb-ng server/server.js client/js/lb-services.js
```

## Install with Docker Compose

```
docker rm $(docker ps -a -q) # optional, remove all un'composed' containers
sudo service docker restart # optional, but should speed things up
git clone https://github.com/Sotera/watchman.git app; cd app # optional if in dev env
cp slc-conf.template.json slc-conf.json
sudo script/docker/install-compose.sh
script/deploy/compose up deploy [branch] # branch optional, default: master
script/deploy/compose scale image-fetcher=3

# hint: add /docker-compose.override.yml to override services.
```

## Misc

```
# build mitie-server image
git clone lukewendling/mitie-server
docker build --no-cache --force-rm -t lukewendling/mitie-server .

docker run -d -p 8888:8888 --name mitie lukewendling/mitie-server
./server/workers/start-extractor.js # start workers
```

```
# run a worker standalone
WORKER_SCRIPT=./workers/job-queue npm run dev
```

## Tests

### Services

```
conda env create -f services/environment.yml
source activate watchman
python services/run_tests.py
```
