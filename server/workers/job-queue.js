// def: trigger job monitors on a schedule

'use strict';

require('dotenv').config({silent: true});

const app = require('../server'),
  _ = require('lodash'),
  jobs = require('../../lib/jobs'),
  JobMonitor = app.models.JobMonitor,
  PreprocessMonitor = require('../../lib/job-monitors/preprocess-monitor'),
  FeaturizeMonitor = require('../../lib/job-monitors/featurize-monitor'),
  ClusterizeMonitor = require('../../lib/job-monitors/clusterize-monitor'),
  AggregateMonitor = require('../../lib/job-monitors/aggregate-monitor'),
  LinkerMonitor = require('../../lib/job-monitors/linker-monitor'),
  createLinkerMonitor = require('../../lib/job-monitors/create-linker-monitor'),
  workerConcurrency = process.env.WORKER_CONCURRENCY || 4
;

console.log('Worker concurrency: %s', workerConcurrency);

module.exports = { start };

// start if run as a worker process
if (require.main === module)
  start();

function start() {
  const queue = jobs.queue;
  // let's run linkermonitor creation in this worker too
  createLinkerMonitor.start(app);

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
  queue.process('job monitor', workerConcurrency, (job, done) => {
    startMonitor(job.data.options, done);
  });
}

// options: jobMonitorId
function startMonitor(options, done) {
  JobMonitor.findById(options.jobMonitorId)
  .then(jobMonitor => {
    if (jobMonitor.featurizer === 'linker')
      linkerize(jobMonitor, done);
    else
      featurize(jobMonitor, done);
  })
  .catch(done);
}

function linkerize(jobMonitor, done) {
  let lMonitor = new LinkerMonitor(jobMonitor, app);

  lMonitor.start();

  lMonitor.on('done', onDone);

  function onDone() {
    // TODO: 'done' when there were errors or warnings?
    jobMonitor.updateAttributes({
      state: 'done',
      done_at: new Date(),
      error_msg: lMonitor.errors.join(',')
    })
    .then(() => done())
    .catch(done);
  }
}

function featurize(jobMonitor, done) {
  let pMonitor, fMonitor, cMonitor, agMonitor;

  pMonitor = new PreprocessMonitor(jobMonitor, app);
  pMonitor.start();

  pMonitor.on('preprocessed', onPreprocessed);

  function onPreprocessed() {
    jobMonitor.updateAttributes({state: 'preprocessed'})
    .then(jobMonitor => {
      fMonitor = new FeaturizeMonitor(jobMonitor, app);
      fMonitor.on('featurized', onFeaturized);
      fMonitor.start();
    })
    .catch(done);
  }

  function onFeaturized() {
    jobMonitor.updateAttributes({state: 'featurized'})
    .then(jobMonitor => {
      cMonitor = new ClusterizeMonitor(jobMonitor, app);
      cMonitor.on('clustered', onClustered);
      cMonitor.start();
    })
    .catch(done);
  }

  function onClustered() {
    jobMonitor.updateAttributes({state: 'clustered'})
    .then(jobMonitor => {
      agMonitor = new AggregateMonitor(jobMonitor, app);
      agMonitor.on('done', onDone);
      agMonitor.start();
    })
    .catch(done);
  }

  function onDone() {
    // TODO: 'done' when there were errors or warnings?
    let errors = pMonitor.errors
      .concat(fMonitor.errors)
      .concat(cMonitor.errors)
      .concat(agMonitor.errors);
    jobMonitor.updateAttributes({
      state: 'done',
      done_at: new Date(),
      error_msg: errors.join(',')
    })
    .then(() => done())
    .catch(done);
  }
}
