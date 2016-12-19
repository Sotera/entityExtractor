#!/usr/bin/env node
'use strict';

// def: create synchronous jobSets, which subsequently create job monitors
// once a min num of smposts are found.

try {
  require('dotenv').config({silent: true});
} catch(ex) {}

const API_ROOT = process.env.API_ROOT;

if (!API_ROOT) {
  throw new Error('Missing required API_ROOT env var');
}

const log = require('./server/util/log'),
  debug = log.debug,
  _ = require('lodash'),
  request = require('request-json'),
  client = request.createClient(API_ROOT + '/')
;

if (!process.env.DEBUG)
  console.info(`add DEBUG=${log.debugName} for debug messages`);

const MIN_POSTS = 1000,
  RETRY_MULTIPLIER = 3,
  QUERY_SPAN = 1000 * 60 * 2, // min
  LOOP_INTERVAL = 1000 * 60, // sec
  SEED_TIME = 1481124174000,
  MAX_RETRIES = QUERY_SPAN * RETRY_MULTIPLIER / LOOP_INTERVAL
;

// boot up with seed time
schedule(SEED_TIME);


function schedule(startTime) {
  let endTime = startTime + QUERY_SPAN;

  if (endTime > Date.now()) {
    debug('endtime > now. waiting...');
    reschedule(startTime);
  } else {
    createJobSet(startTime, endTime)
      .then(jobSet => {
        debug('current job set:', jobSet, new Date())
        if (_.includes(['skip', 'done'], jobSet.state))
          // reschedule for immediate run
          reschedule(endTime + 1, 0);
        else // new, running
          reschedule(startTime);
      })
      .catch(console.error);
  }

  function reschedule(startTime, interval) {
    // any non-null val for interval is used, incl. 0
    interval = (interval == null) ? LOOP_INTERVAL : interval;
    setTimeout(() => schedule(startTime), interval);
  }
}


function createJobSet(startTime, endTime) {
  let jobSetsParams = [
    `filter[where][start_time]=${startTime}`,
    `filter[where][end_time]=${endTime}`
  ];

  let smPostsParams = [
    `[where][timestamp_ms][between][0]=${startTime}`,
    `[where][timestamp_ms][between][1]=${endTime}`,
    '[where][state]=new'
  ];

  jobSetsParams = jobSetsParams.join('&');
  smPostsParams = smPostsParams.join('&');

  return client.get('jobsets?' + jobSetsParams)
    .then(res => {
      let jobSet = res.body[0];
      if (jobSet) {
        if (jobSet.state === 'new')
          return updateJobSet(jobSet);
        else
          return jobSet;
      } else {
        return client.post('jobsets', {
          start_time: startTime, end_time: endTime
        })
        .then(res => updateJobSet(res.body));
      }
    });

  function updateJobSet(jobSet) {
    return client.get('socialmediaposts/count?' + smPostsParams)
      .then(res => {
        let count = res.body.count;
        debug('smposts count:', count);
        if (count >= MIN_POSTS) {
          return client.put(`jobsets/${jobSet.id}`, { state: 'running' })
            .then(res => res.body);
          // triggers monitors creation
        } else {
          debug('%s posts and we need %s', count, MIN_POSTS);
          debug('%s of %s retries', jobSet.retries, MAX_RETRIES);
          if (MAX_RETRIES == jobSet.retries) {
            return client.put(`jobsets/${jobSet.id}`, { state: 'skip' })
              .then(res => res.body);
          } else {
            jobSet.retries += 1;
            return client.put(`jobsets/${jobSet.id}`, { retries: jobSet.retries })
              .then(res => res.body);
          }
        }
      })
  }
}
