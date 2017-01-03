'use strict';

// def: send jobs to event finder service

const idGen = require('../id-generator'),
      redis = require('../redis'),
      debug = require('../../server/util/log').debug,
      _ = require('lodash');

try {
  require('dotenv').config({silent: true});
} catch(ex) {}

const API_ROOT = process.env.API_ROOT;
const KAFKA_URL = process.env.KAFKA_URL;
const KAFKA_TOPIC = process.env.KAFKA_TOPIC;
const EVENT_FINDER_INTERVAL = process.env.EVENT_FINDER_INTERVAL_MIN ?
  +process.env.EVENT_FINDER_INTERVAL_MIN :
  1440;

if (!API_ROOT) {
  throw new Error('Missing required API_ROOT env var');
}

const jobSetCheckInterval = 30000; //ms

let app,
    interval,
    findEventsInterval = 1000 * 60 * EVENT_FINDER_INTERVAL,
    currentJob,
    lastWindow = null,
    SocialMediaPost,
    Event,
    JobSet,
    jobPrefix = 'genie:',
    keyPrefix = jobPrefix + 'eventfinder:';


module.exports = {
  start(appObject) {
    app = appObject;
    SocialMediaPost = app.models.SocialMediaPost;
    Event = app.models.Event;
    JobSet = app.models.JobSet;

    run();
    function run() {
      interval = setInterval(function(){
        checkJobSetStatus();
      }, jobSetCheckInterval);
    }
  }
};

function catchUpToEventsIfPossible(){
  return new Promise(
    function (resolve, reject) {
      if(lastWindow){ //we have a previous run..so just use it to seed the next time window.
        resolve(lastWindow.end_time+1);
        return;
      }
      let args = {order: 'end_time_ms DESC' };

      Event.findOne(args)
        .then(function(model, err){
          if(err){
            reject(err);
            return;
          }
          if(!model){
            resolve();
            return;
          }
          resolve(model.end_time_ms + 1);
        })
        .catch(reject);
    });
}

function catchUpToFirstJobsetIfPossible(){
  return new Promise(function (resolve, reject) {
    //if we dont have a default start time by catching up to events, find the first job set and get the start time
    JobSet.findOne().then((model,err)=>{
      if(!model || err || model.state !== 'done'){
        reject('There are no JobSets available so we cannot start finding events...bailing.');
        return;
      }
      let start = model.start_time;
      resolve(start);
    });
  });
}

function verifyTimeWindow(window){
  return new Promise(
    function (resolve, reject) {
      //initial time travel check...no future events yet...
      if (window.end_time > Date.now()) {
        return resolve(false);
      }

      let args = {
        where: {
          end_time: {
            gt: window.end_time
          }
        }
      };

      JobSet.findOne(args)
      .then((model,err)=>{
        if(err){
          return reject('query error getting JobSet: %s', err);
        }
        if(!model || model.state !== 'done'){
          return reject('There are no finished JobSets with an end date greater than our window end date...bailing.');
        }
        resolve(true);
      })
      .catch(reject);
    });
}

function calculateJobsetTimes(startTime){
  let timeWindow = null;
  return new Promise(
    function (resolve, reject) {
      if (!startTime) {
        //no start time available from events...try job sets
        catchUpToFirstJobsetIfPossible()
        .then(start =>{
          return {start_time:start, end_time: start + findEventsInterval};
        })
        .then(window=>{
          timeWindow = window;
          return verifyTimeWindow(window);
        })
        .then(goodWindow=>{
          goodWindow ?
            resolve(timeWindow) :
            reject('Calculated Time window failed verification');
        })
        .catch(reject);
      } else {
        //we have a start time...so calculate the window and get it verified.
        let endTime = startTime + findEventsInterval;
        let window = {start_time:startTime, end_time:endTime};
        verifyTimeWindow(window)
        .then(goodWindow=>{
          goodWindow ?
            resolve(window) :
            reject("Calculated Time window failed verification");
        })
        .catch(reject);
      }
    });
}

function executeEventFinder(window){
  return new Promise(
    function (resolve, reject) {
      try {
        currentJob = submitJob(window);
        resolve('Job running: %s', currentJob);
      } catch(err){
        debug('Event Finder err: %s', err);
        reject('Event Finder err: %s', err);
      }
    });
}

function generateJobKey() {
  let key;
  // N.B. not universally unique if queue is in-memory.
  // assumes rare mishaps are ok.
  key = keyPrefix + idGen.randomish(0, 9999999999);
  return key;
}

function submitJob(window) {
  const key = generateJobKey();

  let queueName = jobPrefix + 'eventfinder';

  const jobAttrs = {
    host: API_ROOT,
    start_time: window.start_time.toString(),
    end_time: window.end_time.toString(),
    state: 'new'
  };

  if(KAFKA_URL){
    jobAttrs.kafka_url = KAFKA_URL;
  }
  if(KAFKA_TOPIC){
    jobAttrs.kafka_topic = KAFKA_TOPIC;
  }

  redis
    .hmset(key, jobAttrs)
    .then(() => redis.lpush(queueName, key))
    .then(() => debug('%s submitted', key))
    .catch(err => console.error(key, err.stack));

  return key;
}

function updateProgress(){
  return redis.hgetall(currentJob)
    .then(data => {
      if (!data) {
        console.error('%s not found', currentJob);
        currentJob = null;
      } else if (data.state === 'processed') {
        currentJob = null;
        redis.del(currentJob); //good citizen cleanup
      } else if (data.state === 'error') {
        console.error('%s reported an error: %s', currentJob, data.error);
        redis.del(currentJob); //good citizen cleanup
        currentJob = null;
      } else {
        debug('not finished: %s state: %s', currentJob, data.state);
      }
    })
    .catch(err => {
      console.error('polling err for %s: %s', currentJob, err.stack);
      currentJob = null;
      redis.del(currentJob);
    });
}

function checkJobSetStatus() {
  if(currentJob){
    return updateProgress();
  }

  catchUpToEventsIfPossible() //fast forward to the last event and use its end time + 1 as the new start time
  .then(startTime=>{
    return calculateJobsetTimes(startTime);
  })
  .then(times=>{
    //we have a good time window...we save it for later.
    lastWindow = times;
    return executeEventFinder(times);
  })
  .catch(debug);
}
