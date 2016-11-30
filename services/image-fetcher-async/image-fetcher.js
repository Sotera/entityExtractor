'use strict';

// def: Parse a social media page's content to find the user-submitted image
// and download it for processing. Assumes image is jpeg format.
// returns custom exceptions so caller can distinguish between expected
  // problems like timeouts, unspecified domains, and unexpected errors.

// http://stackoverflow.com/questions/24320578/node-js-get-request-etimedout-esockettimedout/37946324#37946324
// ESOCKETTIMEDOUT or ETIMEDOUT due to DNS lookups in Node
process.env.UV_THREADPOOL_SIZE = 128;

const trumpet = require('trumpet'),
  request = require('request'),
  fs = require('fs'),
  mkdirp = require('mkdirp'),
  path = require('path'),
  uuid = require('uuid'),
  through2 = require('through2'),
  FetchException = require('./fetch-exception'),
  debug = require('debug')
  ;

// require('request').debug = true

// per module's docs, 'pool' settings should be at module level when
// looping or concurrent processing
require('request').defaults = {
  timeout: 10000, //ms
  maxRedirects: 2,
  forever: false,
  pool: { maxSockets: Infinity }
};

module.exports = { fetchImage };

// callback: function(err, data)
function fetchImage(url, downloadPath, callback) {
  if (!validUrl(url)) {
    return callback(new FetchException(`skipping ${url}`));
  }

  const tr = trumpet();
  let match = false;

  downloadPath = downloadPath || '.';
  mkdirp(downloadPath);
  // 511 decimal == 0777 octal
  fs.chmodSync(downloadPath, 511);

  // 1) Set up html parser + attach pipes:
  // outer: for a non-enclosing tag like meta.
  // twitter & instagram use FB open graph tags.
  tr.createReadStream('meta[property="og:image"]', {outer: true})
  .on('end', () => {
    // trumpet stops piping when no matches. ugh.
    // HACK: 'data' handler checks for selector success.
    // TODO: better way to return 'no matches'?
    if (!match)
      callback(new FetchException('could not find image info'));
  })
  .on('data', data => {
    let line = data.toString();
    match = /og:image/i.test(line);
  })
  .pipe(findImageUrl())
    .on('error', callback)
  .pipe(downloadImage(downloadPath, url))
    .on('error', callback)
    .on('data', data => {
      // return final result
      callback(null, data.toString());
    });

  // 2) Start the pipeline
  require('request')
  .get(url)
  .on('response', function(res) {
    if (res.statusCode > 399)
      callback(new FetchException(`statuscode ${res.statusCode} for ${url}`));
  })
  .on('error', err => {
    callback(new FetchException(`failed to get ${url} - ${err}`));
  })
  .pipe(tr);
}

function findImageUrl() {
  return through2((chunk, enc, cb) => {
    let content = chunk.toString(); // from buffer
    let matches = content.match(/(http.*)"/i);

    if (matches) {
      let url = matches[1];
      /\/profile/i.test(url) ?
        cb(new FetchException('image url found but was profile pic')) :
        cb(null, url);
    } else {
      cb(new FetchException('image url not found'));
    }
  });
}

function validUrl(url) {
  // catch bogus concatenated urls like 'http://foo.com,http://bar.com'
  // TODO: why not caught somewhere upstream?
  let parts = url.split(',');
  if (parts.length > 1)
    return false;

  return /instagram\.com/i.test(url) ||
  /twitter\.com/i.test(url)
}

function downloadImage(downloadPath, origUrl) {
  // all downloads expected to be jpeg format
  let imagePath = path.join(downloadPath, uuid.v4() + '.jpg');

  return through2((chunk, enc, cb) => {
    let imageUrl = chunk.toString(),
      ws = fs.createWriteStream(imagePath);
    require('request')
    .get(imageUrl)
    .on('response', function(res) {
      if (res.statusCode > 399)
        cb(new FetchException(`statuscode ${res.statusCode} for ${imageUrl}`));
    })
    .on('error', err => {
      // del empty files
      fs.unlinkSync(imagePath);
      cb(new FetchException(`failed to download ${imageUrl}`));
    })
    .on('end', () => {
      // seems that request errors still emit 'end'. so file might not exist.
      try {
        // del empty files
        let stats = fs.statSync(imagePath);
        if (!stats.size)
          fs.unlinkSync(imagePath);
        let output = {
          path: imagePath,
          url: imageUrl
        };
        cb(null, JSON.stringify(output));
      } catch(e) {
        cb(e);
      }
    })
    .pipe(ws);
  });
}

if (require.main === module) {
  // fetchImage('https://www.instagram.com/p/BJsmWmLDiD3/', './tmp', console.log)
  fetchImage('https://www.facebook.com/photo.php?fbid=10157557232495468', './tmp', console.log)
  // fetchImage('https://twitter.com/Abizy_m/status/775762443817607170', './tmp', console.log)
  // fetchImage('https://www.swarmapp.com/c/8Ez3xo3RtcP')
}
