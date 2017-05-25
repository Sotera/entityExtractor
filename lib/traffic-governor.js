'use strict';

// def: govern (rate limit) high volume traffic.

require('dotenv').config({silent: true});

let count = 0,
  governRate = +process.env.GOVERN_RATE,
  governCap = 1/governRate;

module.exports = {
  allow() {
    if (governRate > 1)
      throw new Error('invalid GOVERN_RATE');

    // if not set or eq 0
    if (!governRate)
      return true;

    if (count >= governCap) {
      // allow this one
      count = 0;
      return true;
    } else {
      // return nil to indicate governance
      count++;
      return false;
    }
  }
};
