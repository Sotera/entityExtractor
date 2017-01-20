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
  LinkerMonitor = require('../../lib/job-monitors/linker-monitor'),
  createLinkerMonitor = require('../../lib/job-monitors/create-linker-monitor'),
  workerConcurrency = process.env.WORKER_CONCURRENCY || 4;

//TODO: Remove these when event finding is turned into a job monitor.
const redis = require('../../lib/redis'),
  idGen = require('../util/id-generator'),
  { API_ROOT, KAFKA_URL, KAFKA_TOPIC } = process.env;

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
    .then(updateJobSet)
    .then(() => {
      //TODO: Remove this when we turn event finding into a job monitor
      done();
      findEvents(jobMonitor);
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

function generateJobKey(keyPrefix) {
  // N.B. not universally unique if queue is in-memory.
  // assumes rare mishaps are ok.
  return keyPrefix + idGen.randomish(0, 9999999999);
}

function findEvents(jobMonitor) {
  const queueName = 'genie:eventfinder',
    key = generateJobKey(queueName),
    jobAttrs = {
      host: API_ROOT,
      start_time: jobMonitor['start_time'].toString(),
      end_time: jobMonitor['end_time'].toString(),
      state: 'new'
    };

  if (KAFKA_URL) {
    jobAttrs.kafka_url = KAFKA_URL;
  }
  if (KAFKA_TOPIC) {
    jobAttrs.kafka_topic = KAFKA_TOPIC;
  }

  return redis
    .hmset(key, jobAttrs)
    .then(() => redis.lpush(queueName, key))
    .catch(err => console.error(key, err.stack));
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
