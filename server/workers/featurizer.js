// def: trigger featurizer jobs and get results from redis

'use strict';

require('dotenv').config({silent: true});

const es = require('elasticsearch'),
  destClient = new es.Client({
    host: process.env.ES_HOST || 'elasticsearch',
    requestTimeout: 60000,
    log: 'error'
  }),
  destIndex = process.env.ES_INDEX || 'stream',
  destType = process.env.ES_TYPE || 'tweet',
  fs = require('fs'),
  path = require('path'),
  mkdirp = require('mkdirp'),
  redis = require('../../lib/redis'),
  _ = require('lodash'),
  dir = require('node-dir'),
  downloadPath = process.env.DOWNLOAD_PATH || '/downloads',
  queuedImagesDir = path.join(downloadPath, destType, 'images'),
  processedImagesDir = path.join(queuedImagesDir, 'done'),
  channelName = 'features',
  POLL_WAIT = 30 // seconds
;

let queue = new Set(); // jobs in-process

const worker = module.exports = {
  start() {
    console.log('Polling for images in %s', queuedImagesDir);
    run();

    // kickoff secondary process to save featurizer results
    setInterval(pollResults, POLL_WAIT * 1000);
  }
};

// start if run as a worker process
if (require.main === module)
  worker.start();

function run() {
  prep()
  .then(getImages)
  .then(() => {
    setTimeout(run, POLL_WAIT * 1000);  // poll for new files
    console.log('Pausing featurizer for %d sec ...', POLL_WAIT);
  })
}

function prep() {
  mkdirp.sync(queuedImagesDir); // just in case not exists
  mkdirp.sync(processedImagesDir);
  return Promise.resolve();
}

function getImages() {
  return new Promise((res, rej) => {
    dir.readFilesStream(queuedImagesDir,
      { match: /\.(jpg|jpeg|png)$/,
        recursive: false
      },
      (err, stream, next) => {
        if (err) return rej(err);
        let f = stream.path,
          renamed = f;
        console.log('found image to featurize: %s', f);
        // mark complete
        if (process.env.NODE_ENV === 'production') {
          renamed = path.join(processedImagesDir, path.basename(f));
          fs.renameSync(f, renamed);
        }
        triggerFeaturizer(renamed)
        .then(key => queue.add(key))
        .then(() => next())
        .catch(err => {
          console.error(err);
          next();
        });
      },
      (err, files) => {
        if (err) return rej(err);

        return res();
      }
    );
  })
  .catch(console.error);
}

// for redis, add channel prefix
function getFeaturizerKey(id) {
  return channelName + ':' + id;
}

// for ES, remove channel prefix
function getRecordId(key) {
  return key.replace(channelName + ':', '');
}

function triggerFeaturizer(filePath) {
  const key = getFeaturizerKey(getBasename(filePath));
  return Promise.all([
    redis.hmset(key, { path: filePath, state: 'downloaded' }),
    redis.publish(channelName, key)
  ])
  .then(() => key); // return key for later polling
}

function pollResults() {
  console.log('polling for featurizer results');
  queue.forEach(key => {
    redis.hgetall(key)
    .then(data => {
      if (!data) {
        console.log('%s not found', key);
        queue.delete(key);
      } else if (data.state === 'processed') {
        if (_.isEmpty(data.data)) {
          console.error('%s is missing features data', key);
        } else {
          let features = JSON.parse(data.data)[0].features[0];
          saveFeatures(getRecordId(key), features);
        }
        queue.delete(key);
        redis.del(key); //good citizen cleanup
      } else if (data.state === 'error') {
        console.error('%s reported an error: %s', key, data.error);
        queue.delete(key);
        redis.del(key); //good citizen cleanup
      } else {
        console.log('not finished: %s state: %s', key, data.state);
      }
    })
    .catch(err => {
      console.error('polling err for item %s', key, err);
      queue.delete(key);
    });
  });
}

function saveFeatures(recordId, features) {
  return destClient.update({
    id: recordId,
    index: destIndex,
    type: destType,
    body: { doc: {features: features} }
  })
  .then(() => console.log('features saved for %s', recordId))
  .catch(console.error);
}

// file basename less file ext.
function getBasename(filePath) {
  const parts = path.basename(filePath).split('.');
  return parts.slice(0, parts.length - 1);
}
