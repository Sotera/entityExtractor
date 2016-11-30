'use strict';

// def: used for control flow techniques to differentiate from errors.
// from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
function FetchException(message) {
  this.message = message;
  let lastPart = new Error().stack.split('\n')[2]; // just the important line
  this.stack = `${this.name} ${lastPart}`;
 }
FetchException.prototype = Object.create(Error.prototype);
FetchException.prototype.name = 'FetchException';
FetchException.prototype.message = '';
FetchException.prototype.constructor = FetchException;

module.exports = FetchException;
