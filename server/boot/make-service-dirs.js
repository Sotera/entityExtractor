'use strict';

const mkdirp = require('mkdirp');

// create shared /downloads dirs. various services will use these.
module.exports = function(app) {
  const oldMask = process.umask();
  process.umask(0); // https://github.com/nodejs/node-v0.x-archive/issues/7591
  ['features', 'threats', 'image-fetcher'].forEach(dir => {
    mkdirp.sync(`/downloads/${dir}`, parseInt('0777', 8));
  });
  process.umask(oldMask); // reset
};
