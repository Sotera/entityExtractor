'use strict';

// def: generate id's for jobs, etc.

module.exports = {
  // when random isn't uber important
  randomish(min, max) {
    min = min || 100000;
    max = max || 1000000; // exclusive upper bound
    return Math.floor(Math.random() * (max - min)) + min;
  }
};
