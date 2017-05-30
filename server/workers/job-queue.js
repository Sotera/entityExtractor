'use strict';

// def: handle job requests to start job monitors

require('dotenv').config({silent: true});

const app = require('../server'),
  { JobMonitor } = app.models,
  jobs = require('../../lib/jobs'),
  PreprocessMonitor = require('../../lib/job-monitors/preprocess-monitor'),
  FeaturizeMonitor = require('../../lib/job-monitors/featurize-monitor'),
  ClusterizeMonitor = require('../../lib/job-monitors/clusterize-monitor'),
  LinkerMonitor = require('../../lib/job-monitors/linker-monitor'),
  eventFinder = require('../../lib/event-finder'),
  createLinkerMonitor = require('../../lib/job-monitors/create-linker-monitor'),
  redis = require('../../lib/redis');

module.exports = { start };

// start if run as a worker process
if (require.main === module)
  start();

function start() {
  // boot job processor with job handlers
  jobs.boot(new Map([
    ['job monitor', startMonitor],
    ['chart data', createChartData]
  ]));

  // mount kue UI
  jobs.mountUI();

  // let's run linkermonitor creation in this worker too
  createLinkerMonitor.start(app);
}

// options: src, type, per-chart variables
function createChartData(options, done) {
  let handler = require(`../chart/${options.src}/${options.type}`);
  handler.execute(options, done);
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
    .then(updateJobSet)
    .then(() => {
      eventFinder.run(jobMonitor.start_time, jobMonitor.end_time);
      done();
    })
    .catch(done);
  }

  function updateJobSet(jobMonitor) {
    return new Promise((res, rej) => {
      jobMonitor.jobSet((err, jobSet) => {
        if (err) rej(err);
        res(jobSet.updateAttributes({state: 'done', done_at: new Date}));
      });
    });
  }
}

function featurize(jobMonitor, done) {
  let pMonitor, fMonitor, cMonitor;

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
      cMonitor.on('done', onDone);
      cMonitor.start();
    })
    .catch(done);
  }

  function onDone() {
    // TODO: 'done' when there were errors or warnings?
    let errors = pMonitor.errors
      .concat(fMonitor.errors)
      .concat(cMonitor.errors);
    jobMonitor.updateAttributes({
      state: 'done',
      done_at: new Date(),
      error_msg: errors.join(',')
    })
    .then(() => done())
    .catch(done);
  }
}

