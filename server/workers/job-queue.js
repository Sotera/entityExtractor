// def: trigger job monitors on a schedule

'use strict';

require('dotenv').config({silent: true});

const app = require('../server'),
  _ = require('lodash'),
  jobs = require('../../lib/jobs'),
  JobMonitor = app.models.JobMonitor,
  FeaturizeMonitor = require('../../lib/job-monitors/featurize-monitor'),
  ClusterizeMonitor = require('../../lib/job-monitors/clusterize-monitor')
;

module.exports = { start };

// start if run as a worker process
if (require.main === module)
  start();

function start() {
  const queue = jobs.queue;

  queue
  .on('job complete', id => {
    console.log('Job complete:', id);
  })
  .on('job failed attempt', (err, count) => {
    console.error('Job attempt (failed):', err, count);
  })
  .on('job failed', err => {
    console.error('Job failed:', err);
  });

  // Graceful shutdown
  process.once('SIGTERM', sig => {
    queue.shutdown(3000, err => {
      console.log('Kue shutdown: ', err || 'no error');
      process.exit(0);
    });
  });

  // process jobs
  queue.process('job monitor', (job, done) => {
    monitor(job.data.options, done);
  });

}

// begin monitoring
// options: jobMonitorId
function monitor(options, done) {
  JobMonitor.findById(options.jobMonitorId)
  .then(jobMonitor => featurize(jobMonitor, done))
  .catch(done);
}

function featurize(jobMonitor, done) {
  let fMonitor = new FeaturizeMonitor(jobMonitor, app),
    cMonitor;

  fMonitor.start();

  fMonitor.on('featurized', onFeaturized);

  function onFeaturized() {
    jobMonitor.updateAttributes({state: 'featurized'})
    .then(jobMonitor => {
      cMonitor = new ClusterizeMonitor(jobMonitor, app);
      cMonitor.on('done', onDone);
      cMonitor.start();
    })
    .catch(done);
  }

  function onDone() {
    // TODO: 'done' when there were errors or warnings?
    let errors = fMonitor.errors.concat(cMonitor.errors);
    jobMonitor.updateAttributes({
      state: 'done',
      done_at: new Date(),
      error_msg: errors.join(',')
    })
    .then(() => done())
    .catch(done);
  }
}
