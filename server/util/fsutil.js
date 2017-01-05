'use strict';

// def: file, dir helpers

const extract = require('extract-zip');

module.exports = {
  // expects zip files
  // TODO handle .tar.gz files
  decompress(filePath) {
    return new Promise((res, rej) => {
      // const downloadPath = filePath.replace(/\.(zip$|(tar.){,1}gz$)/i, '');
      const dir = filePath.replace(/\.zip$/i, '');

      extract(filePath, {dir}, err => {
        if (err) return rej(err);
        res(dir);
      });
    });
  }
};
