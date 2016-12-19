#!/usr/bin/env node
'use strict';

//def: run event find script on interval

try {
  require('dotenv').config({silent: true});
} catch(ex) {}

const spawn = require('child_process').spawn;
const API_ROOT = process.env.API_ROOT;

if (!API_ROOT) {
  throw new Error('Missing required API_ROOT env var');
}

module.exports = findEvents;

// start if run as a worker process
if (require.main === module) {
  const defaults = {
    seedTime: 1478278060490,
    runIntervalMins: 10
  };

  findEvents(defaults);
}

/* params:
   seedTime: time0 for first query
   runIntervalMins: mins between job runs
*/
function findEvents(params) {
  let endTime = params.seedTime,
    runIntervalMins = params.runIntervalMins,
    runIntervalMs = 1000 * 60 * runIntervalMins;

  setInterval(run, runIntervalMs);

  run();

  function run() {
    let startTime = endTime + 1;
    endTime = endTime + runIntervalMs;

    if ((endTime) > Date.now()) {
      console.log('endtime > now. wait til next run in %s sec', Math.floor((endTime - Date.now()) / 1000));
      return;
    }


    let args = ['run', '--rm', 'sotera/dr-manhattan:12', API_ROOT, startTime.toString(), endTime.toString()];
    console.log('running: docker', args.join(' '));

    let job = spawn('docker', args);

    job.stdout.on('data', data => {
      console.log(`stdout: ${data}`);
    });

    job.on('error', err => {
      console.error('Failed to start child process:', err);
    });
  }
}
