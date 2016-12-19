'use strict';

const debug = require('debug'),
  path = require('path');

// def: miscellaneous debug & logging shortcuts
module.exports = {
  // wrap debug module
  get debug() {
    return debug(this.debugName);
  },
  // return calling module's name
  get debugName() {
    return path.basename(module.parent.filename, '.js');
  }
};
