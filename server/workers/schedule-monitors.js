// def: trigger job monitors on a schedule

'use strict';

require('dotenv').config({silent: true});

const app = require('../server'),
  _ = require('lodash'),
  moment = require('moment'),
  JobMonitor = app.models.JobMonitor,
  EventedMonitor = require('../../lib/job-monitors/evented-monitor'),
  QUERY_SPAN_MINS = 10
;


const worker = module.exports = {
  start() {
    run();
  }
};

// start if run as a worker process
if (require.main === module)
  worker.start();

function run() {
  const now = Date.now(); // ms

  JobMonitor.create({
    start_time: now,
    end_time: now + QUERY_SPAN_MINS * 60 * 1000,
    featurizer: 'image',
    state: 'new'
  })
  .then(jobMonitor => {
    const args = _.extend(jobMonitor.toJSON(), {doc: jobMonitor}),
      monit = new EventedMonitor(args);

    monit.start();

    monit.on('done', onDone);

    function onDone() {
      jobMonitor
      .updateAttributes({state: 'done', done_at: new Date()})
      .catch(console.error);
    }
  })
  .catch(console.error);
}
