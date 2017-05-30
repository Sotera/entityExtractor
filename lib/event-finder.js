'use strict';
//Kicks off the dr-manhattan event finding job in redis.
//This is not a job-monitor because we want the event finding process to be independent of the
//job-monitor system, event finding can be run in parallel.
require('dotenv').config({silent: true});

const _ = require('lodash'),
  redis = require('./redis'),
  idGen = require('../server/util/id-generator'),
  keyPrefix = 'genie:eventfinder',
  { API_ROOT, KAFKA_URL, KAFKA_TOPIC, GEO_THRESHOLD } = process.env;

module.exports = {
  findEvents(start_time, end_time) {
    const key = generateJobKey(keyPrefix),
      job = {
        api_root: API_ROOT,
        start_time: start_time.toString(),
        end_time: end_time.toString(),
        state: 'new'
      };

    if (KAFKA_URL) {
      job.kafka_url = KAFKA_URL;
    }
    if (KAFKA_TOPIC) {
      job.kafka_topic = KAFKA_TOPIC;
    }
    if (GEO_THRESHOLD) {
      job.geo_threshold = GEO_THRESHOLD;
    }

    return redis
      .enqueue(key, job, keyPrefix) // use keyprefix as list name
      .catch(err => console.error(key, err.stack));
  }
};

function generateJobKey(keyPrefix) {
  // N.B. not universally unique if queue is in-memory.
  // assumes rare mishaps are ok.
  return keyPrefix + idGen.randomish(0, 9999999999);
}
