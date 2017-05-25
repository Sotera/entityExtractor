'use strict';

// def: govern (rate limit) high volume traffic.

require('dotenv').config({silent: true});

// expects values < 1. i.e. allow 10% of traffic == 0.1
const governRate = +process.env.GOVERN_RATE;

if (governRate > 1 || governRate === 0)
  throw new Error('invalid GOVERN_RATE');

let governCap = 1/governRate,
  ignoredCount = 0;

module.exports = {
  allow() {
    // if not set or eq 0
    if (!governRate)
      return true;

    if (ignoredCount >= governCap) {
      // allow this one
      ignoredCount = 0;
      return true;
    } else {
      // return nil to indicate governance
      ignoredCount++;
      return false;
    }
  }
};
