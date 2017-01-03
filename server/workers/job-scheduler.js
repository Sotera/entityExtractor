// def: find stored feed data and send to ner
'use strict';
const debug = require('debug')('job-scheduler');
try {
  require('dotenv').config({silent: true});
} catch(ex) {}

const API_ROOT = process.env.API_ROOT;
const JOBSET_QUERYSPAN_MIN = process.env.JOBSET_QUERYSPAN_MIN?+process.env.JOBSET_QUERYSPAN_MIN:30;

let SYSTEM_START_TIME = +process.env.SYSTEM_START_TIME;
if (!API_ROOT) {
  throw new Error('Missing required API_ROOT env var');
}
if (!SYSTEM_START_TIME) {
  debug('SYSTEM_START_TIME not set, using current timestamp: %s');
  SYSTEM_START_TIME = Date.now();
}

const _ = require('lodash'); //ms

let app,
    SocialMediaPost,
    JobSet;


const worker = module.exports = {
  start(appObject) {
    app = appObject;
    SocialMediaPost = app.models.SocialMediaPost;
    JobSet = app.models.JobSet;

    schedule(SYSTEM_START_TIME);

  }
};

const MIN_POSTS = 1000,
  RETRY_MULTIPLIER = 3,
  QUERY_SPAN = 1000 * 60 * JOBSET_QUERYSPAN_MIN, // min
  LOOP_INTERVAL = 1000 * 60, // sec
  MAX_RETRIES = QUERY_SPAN * RETRY_MULTIPLIER / LOOP_INTERVAL;

function schedule(startTime) {
  let endTime = startTime + QUERY_SPAN;

  if (endTime > Date.now()) {
    debug('endtime > now. waiting...');
    reschedule(startTime);
  } else {
    createJobSet(startTime, endTime)
      .then(jobSet => {
        debug('current job set:', jobSet, new Date());
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
  let jobSetsParams =
    {
      where:{
        start_time:startTime,
        end_time:endTime
      }
    };

  let smPostsParams =
    {
        timestamp_ms:{
          between:[startTime,endTime]
        }
    };

  jobSetsParams = jobSetsParams;
  smPostsParams = smPostsParams;

  return JobSet.findOne(jobSetsParams)
    .then(jobSet => {
      if (jobSet) {
        if (jobSet.state === 'new')
          return updateJobSet(jobSet);
        else
          return jobSet;
      } else {
        return JobSet.create({
          start_time: startTime, end_time: endTime
        })
          .then(result => updateJobSet(result));
      }
    });

  function updateJobSet(jobSet) {
    return SocialMediaPost.count(smPostsParams)
      .then(count => {
        debug('smposts count:', count);
        if (count >= MIN_POSTS) {
          return JobSet.findOne({where:{id:jobSet.id}})
            .then(res=>res.updateAttribute('state','running'));
        } else {
          debug('%s posts and we need %s', count, MIN_POSTS);
          debug('%s of %s retries', jobSet.retries, MAX_RETRIES);
          if (MAX_RETRIES == jobSet.retries) {
            return JobSet.findOne({where:{id:jobSet.id}})
              .then(res=>res.updateAttribute('state','skip'));
          } else {
            jobSet.retries += 1;
            return JobSet.findOne({where:{id:jobSet.id}})
              .then(res=>res.updateAttribute('retries',jobSet.retries));
          }
        }
      })
  }
}
