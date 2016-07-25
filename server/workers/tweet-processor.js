// def: parses newline-delimited twitter json files, saves images to disk,
// saves tweets to ES.

'use strict';

require('dotenv').config({silent: true});

const es = require('elasticsearch'),
  request = require('request'),
  destClient = new es.Client({
    host: process.env.ES_HOST || 'elasticsearch',
    requestTimeout: 60000,
    log: 'error'
  }),
  destIndex = process.env.ES_INDEX || 'stream',
  destType = process.env.ES_TYPE || 'tweet',
  fs = require('fs'),
  url = require('url'),
  path = require('path'),
  mkdirp = require('mkdirp'),
  dataMapping = require('../../lib/data-mapping'),
  readline = require('readline'),
  _ = require('lodash'),
  dir = require('node-dir'),
  downloadPath = process.env.DOWNLOAD_PATH || '/downloads',
  queuedFilesDir = path.join(downloadPath, destType, 'files'),
  processedFilesDir = path.join(queuedFilesDir, 'done'),
  imagesDir = path.join(downloadPath, destType, 'images'),
  POLL_WAIT = 30 // seconds
;

let images = []; // cached while processing

// ES mapping
const mapping = {
  properties: {
    features: {
      type: 'double'
    }
  }
};

const worker = module.exports = {
  start() {
    console.log('Waiting for files in %s', queuedFilesDir);
    console.log('Saving images to %s', imagesDir);
    run();
  }
};

// start if run as a worker process
if (require.main === module)
  worker.start();

function run() {
  prep()
  .then(processFiles)
  .then(bulkIndex)
  .then(() => saveImages(images))
  .then(() => {
    setTimeout(run, POLL_WAIT * 1000);  // poll for new files
    console.log('Pausing processor for %d sec ...', POLL_WAIT);
  })
  .catch(console.error);
}

function prep() {
  mkdirp.sync(queuedFilesDir);
  mkdirp.sync(processedFilesDir);
  mkdirp.sync(imagesDir);

  images = [];

  return dataMapping.createIndexWithMapping({
    client: destClient, index: destIndex, type: destType, mapping })
  .catch(console.error);
}

function processFiles() {
  let bulkLines = [];

  return new Promise((res, rej) => {
    dir.readFilesStream(queuedFilesDir,
      { match: /\.json$/,
        recursive: false
      },
      (err, stream, next) => {
        if (err) return rej(err);
        console.log('found file to process: %s', stream.path);
        const lineReader = readline.createInterface({
          input: stream,
          terminal: false
        });

        lineReader
        .on('line', line => {
          let altered = alterTweet(line);
          if (altered) {
            // TODO: would be better to stream
            bulkLines.push(JSON.stringify({ create: { _id: altered.id } }));
            bulkLines.push(JSON.stringify(altered));
            // TODO: would be better to stream
            images.push({
              basename: altered.id,
              url: altered.images[0].url
            });
          }
        })
        .on('close', () => next())
        .on('error', rej)
        ;
      },
      (err, files) => {
        if (err) return rej(err);
        if (process.env.NODE_ENV === 'production')
          // mark complete
          files.forEach(f => {
            let renamed = path.join(processedFilesDir, path.basename(f));
            fs.renameSync(f, renamed);
          });
        return res(bulkLines);
      }
    );
  });
}

function bulkIndex(lines) {
  if (!lines || !lines.length) return;
  // chunk lines to prevent ES bulk limits.
  // chunk count must be evenly divisible by 2 for bulk format.
  let chunks = _.chunk(lines, 100);
  let promiseChain = Promise.resolve();
  for (let chunk of chunks) {
    promiseChain = promiseChain
      .then(() => {
        return destClient.bulk({
          index: destIndex,
          type: destType,
          body: chunk.join('\n')
        });
      })
      .then(() => console.log('ES bulk indexing...'))
      .catch(err => console.error('error in ES bulk indexing:', err));
  }
  return promiseChain;
}

function alterTweet(line) {
  let altered = JSON.parse(line);

  // entities.media[0].media_url uses default size
  let imageUrl = _.get(altered, 'instagram.img_url');
  // _.get(altered, 'entities.media[0].media_url')

  // must have a pic
  if (!imageUrl) return;

  altered.id = altered.id_str; // make sure ==
  altered.images = []; // add generic prop to record
  altered.images.push({ url: imageUrl });
  return altered;
}

function saveImages(images) {
  // save each with arbitrary delay to bypass
  // file handler limits, request limits, etc.
  let promiseChain = Promise.resolve();
  for (let img of images) {
    promiseChain = promiseChain
      .then(() => saveImage(img))
      .then(() => console.log('saving image %s...', img.url))
      .then(() => slowdown(333))
      .catch(err => console.error('error saving %s', img.url));
  }
  return promiseChain;
}

function getFilePath(image) {
  const parsed = url.parse(image.url);
  const pathParts = parsed.pathname.split('.');
  const ext = '.' + pathParts[pathParts.length-1];
  const imagePath = path.join(imagesDir, image.basename) + ext;
  return imagePath;
}

function saveImage(image) {
  return new Promise((res, rej) => {
    const imagePath = getFilePath(image);
    const imageStream = fs.createWriteStream(imagePath);
    const imageReq = request(image.url);

    imageStream
      .on('finish', () => res())
      .on('error', err => {
        fs.unlink(imagePath);
        rej(err);
      });

    imageReq
      .on('error', err => {
        console.error(err);
        fs.unlink(imagePath);
      });

    imageReq.pipe(imageStream);
  });
}

// arbitrary slowdown to ease http requests
function slowdown(interval) {
  interval = interval || 5000;
  return new Promise(res => {
    setTimeout(res, interval);
  });
}
