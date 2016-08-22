#!/usr/bin/env node
'use strict';

//def: runs job monitors on at specified interval

require('dotenv').config({silent: true});

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
  //english
  runJob({
    seedTime: 1470949776000,
    runIntervalMins: 60,
    querySpanMins: 15,
    minPostsCount: 10,
    lang: 'en',
    featurizer: 'text'
  });
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
    let startTime = endTime + 1;

    endTime += 1000 * 60 * querySpanMins;

    if (endTime > Date.now()) {
      console.log('endtime > now. stopping.');
      return
    }

    let jobMonitorParams = {
      lang: params.lang,
      featurizer: params.featurizer,
      start_time: startTime,
      end_time: endTime
    };

    //REST API params
    let postsParams = [
      fmt('[where][timestamp_ms][between][0]=%s', startTime),
      fmt('[where][timestamp_ms][between][1]=%s', endTime),
      fmt('[where][lang]=%s', params.lang),
      fmt('[where][featurizer]=%s', params.featurizer),
      fmt('[where][state]=%s', 'new')
    ].join('&');

    console.log('query params: %j', jobMonitorParams);

    client.get('socialmediaposts/count?' + postsParams)
    .then(res => {
      let count = res.body.count;
      console.log('found %s posts', count);
      if (count > minPostsCount) {
        client.post('jobmonitors', jobMonitorParams)
        .then(res => console.log(res.body))
        .catch(console.error);
      } else {
        console.log('%s posts isn\'t enough. moving on...', count);
        run();
      }
    })
    .catch(console.error);
  }
}
