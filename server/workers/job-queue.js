// def: trigger job monitors on a schedule

'use strict';

require('dotenv').config({silent: true});

//TODO: find a better way to know when all timeframed monitors are done
const MONITOR_TYPES_COUNT = process.env.MONITOR_TYPES_COUNT;

if (!MONITOR_TYPES_COUNT) {
  throw new Error('Missing required MONITOR_TYPES_COUNT env var');
}

const app = require('../server'),
  _ = require('lodash'),
  jobs = require('../../lib/jobs'),
  JobMonitor = app.models.JobMonitor,
  FeaturizeMonitor = require('../../lib/job-monitors/featurize-monitor'),
  ClusterizeMonitor = require('../../lib/job-monitors/clusterize-monitor'),
  LinkerMonitor = require('../../lib/job-monitors/linker-monitor')
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
    startMonitor(job.data.options, done);
  });

}

// let's use this worker to check all JobMonitor
// changes and try to start a LinkerMonitor when:
  // 1. a monitor is updated to 'done'
  // 2. all its related monitors (non-linker, same timeframe) are also done

JobMonitor.createChangeStream((err, changes) => {
  if (err) return console.error('change stream err:', err);

  changes.on('data', target => {
    // console.info('JobMonitor changes:', target);
    const jobMonitor = target.data;

    if (target.type === 'update' &&
      jobMonitor.state === 'done' &&
      jobMonitor.featurizer !== 'linker') {

      JobMonitor.count({
        start_time: jobMonitor.start_time,
        end_time: jobMonitor.end_time,
        state: 'done',
        featurizer: { neq: 'linker' }
      })
      .then(count => {
        if (count === +MONITOR_TYPES_COUNT) {
          // TODO: re-run if one of the monitors changes.
          // if multiple monitors change?
          // if some monitors set start = false
          return JobMonitor.create({
            start_time: jobMonitor.start_time,
            end_time: jobMonitor.end_time,
            featurizer: 'linker'
          });
        }
      });
    }
  });
});

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
