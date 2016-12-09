#!/usr/bin/env node
'use strict';

//def: runs job monitors on at specified interval

try {
  require('dotenv').config({silent: true});
} catch(ex) {}

const API_ROOT = process.env.API_ROOT;

if (!API_ROOT) {
  throw new Error('Missing required API_ROOT env var');
}

const request = require('request-json'),
  client = request.createClient(API_ROOT + '/'),
  fmt = require('util').format
;

module.exports = runJob;

// start if run as a worker process
if (require.main === module) {
  const defaults = {
    seedTime: 1478296649899,
    runIntervalMins: 10,
    querySpanMins: 10,
    minPostsCount: 0
  };

  //english
  runJob(Object.assign({
    service_args: { similarity_threshold: 0.65 },
    lang: 'en',
    featurizer: 'text'
  }, defaults));
  //ar
  runJob(Object.assign({
    service_args: { similarity_threshold: 0.65 },
    lang: 'ar',
    featurizer: 'text'
  }, defaults));
  //hashtags
  runJob(Object.assign({
    featurizer: 'hashtag'
  }, defaults));
  //images
  runJob(Object.assign({
    service_args: { similarity_threshold: 0.39 },
    featurizer: 'image'
  }, defaults));
}

/* params:
   seedTime: time0 for first query
   runIntervalMins: mins between job runs
   querySpanMins: time window used in posts query
   minPostsCount: min found posts to start job
   lang
   featurizer
*/
function runJob(params) {
  let endTime = params.seedTime,
    runIntervalMins = params.runIntervalMins,
    querySpanMins = params.querySpanMins,
    minPostsCount = params.minPostsCount
  ;

  setInterval(run, 1000 * 60 * runIntervalMins);

  run();

  function run() {
    let startTime = endTime + 1,
      span = 1000 * 60 * querySpanMins;

    if ((endTime + span) > Date.now()) {
      console.log('endtime > now. wait til next run in %s sec', Math.floor((endTime + span - Date.now()) / 1000));
      return
    }

    endTime += span;

    let jobMonitorParams = {
      featurizer: params.featurizer,
      start_time: startTime,
      end_time: endTime
    };

    if (params.service_args)
      jobMonitorParams.service_args = params.service_args;

    if (params.lang)
      jobMonitorParams.lang = params.lang;

    //REST API params
    let postsParams = [
      fmt('[where][featurizer]=%s', params.featurizer),
      fmt('[where][timestamp_ms][between][0]=%s', startTime),
      fmt('[where][timestamp_ms][between][1]=%s', endTime),
      fmt('[where][state]=%s', 'new')
    ];

    if (params.lang)
      postsParams.push(fmt('[where][lang]=%s', params.lang));

    postsParams = postsParams.join('&');

    console.log('query params: %j', jobMonitorParams);

    client.get('socialmediaposts/count?' + postsParams)
    .then(res => {
      let count = res.body.count;
      console.log('found %s posts', count);
      if (count >= minPostsCount) {
        client.post('jobmonitors', jobMonitorParams)
        .then(res => {
          const body = res.body;
          console.log(body);
          if (body.error && body.error.code === 11000) {
            console.log('dupe jobmonitor. moving on...');
            run();
          }
        })
        .catch(console.error);
      } else {
        console.log('%s posts isn\'t enough. moving on...', count);
        run();
      }
    })
    .catch(console.error);
  }
}
