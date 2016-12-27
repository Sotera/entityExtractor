// def: find stored feed data and send to ner
'use strict';
const spawn = require('child_process').spawn;
const debug = require('debug')('event-finder');
try {
  require('dotenv').config({silent: true});
} catch(ex) {}

const API_ROOT = process.env.API_ROOT;

if (!API_ROOT) {
  throw new Error('Missing required API_ROOT env var');
}

const request = require('request'),
  _ = require('lodash'),
  JobSetCheckInterval = 30000; //ms

let app,
    interval,
    findEventsInterval = 15 *60 * 1000,
    currentJob,
    lastWindow = null,
    SocialMediaPost,
    Event,
    JobSet;


const worker = module.exports = {
  start(appObject) {
    app = appObject;
    SocialMediaPost = app.models.SocialMediaPost;
    Event = app.models.Event;
    JobSet = app.models.JobSet;

    run();
    function run() {
      interval = setInterval(function(){
        checkJobSetStatus();
      },JobSetCheckInterval);
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
            if(err != null){
              reject(err);
              return;
            }
            if(!model){
              resolve(null);
              return;
            }
            resolve(model.end_time_ms + 1);
          })
          .catch(error => {
            reject(error);
          });

    });

}
function catchUpToFirstJobsetIfPossible(){
  return new Promise(function (resolve, reject) {
      //if we dont have a default start time by catching up to events, find the first job set and get the start time
      JobSet.findOne().then((model,err)=>{
        if(!model || err || model.state != 'done'){
          reject("There are no JobSets available so we cannot possibly start finding events...bailing.");
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
        resolve(false);
        return;
      }

      let args = {
        where: {
          end_time:{
            gt:window.end_time
          }
        }};

      JobSet.findOne(args)
      .then((model,err)=>{
        if(err){
          reject("query error trying to get Job Set: " + err);
          return;
        }
        if(!model || model.state != 'done'){
          reject("There are no finished JobSets with an end date greater than our window end date...bailing.");
          return;
        }
        resolve(true);
      })
      .catch(error => {
        reject(error);
      });

    });
}

function calculateJobsetTimes(startTime){
  let timeWindow = null;
  return new Promise(
    function (resolve, reject) {
      if (!startTime) {//no start time available from events...try job sets
        catchUpToFirstJobsetIfPossible()
        .then(start =>{
          return {start_time:start, end_time: start + findEventsInterval};
        })
        .then(window=>{
          timeWindow = window;
          return verifyTimeWindow(window);
        })
        .then(goodWindow=>{
          goodWindow?resolve(timeWindow):reject("Calculated Time window failed verification");
        })
        .catch(error => {
          reject(error);
        });
        return;
      }

      //we have a start time...so calculate the window and get it verified.
      let endTime = startTime + findEventsInterval;
      let window = {start_time:startTime, end_time:endTime};
      verifyTimeWindow(window)
      .then(goodWindow=>{
        goodWindow?resolve(window):reject("Calculated Time window failed verification");
      })
      .catch(error => {
        reject(error);
      });
    });
}

function executeEventFinder(window){
  return new Promise(
    function (resolve, reject) {
      let args = ['run', '--rm',
        'sotera/dr-manhattan:13',
        API_ROOT,
        window.start_time.toString(),
        window.end_time.toString()];

      debug('running: docker %s', args.join(' '));

      try {
        currentJob = spawn('docker', args);
      }
      catch(err){
        debug('Event Finder: %s',err);
      }
      currentJob.stdout.on('data', data => {
        debug('Event Finder: %s', data);
      });

      currentJob.on('exit', (code,signal) => {
        currentJob = null;
        resolve('Job exited with code: ' + code);
      });

      currentJob.on('error', err => {
        reject('Failed to start child process' + err);
      });
    });

}

function checkJobSetStatus() {
  if(currentJob != null){
    return;
  }
  catchUpToEventsIfPossible() //fast forward to the last event and use its end time + 1 as the new start time
  .then(startTime=>{
    return calculateJobsetTimes(startTime)})
  .then(times=>{
    //we have a good time window...we save it for later.
    lastWindow = times;
    executeEventFinder(times)})
  .catch(error => {
    debug('%s', error);
  });
}
