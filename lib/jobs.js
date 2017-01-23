'use strict';

// def: wrapper for kue job processor

const _ = require('lodash'),
  kue = require('kue'),
  kueConfig = {
    jobEvents: false,
    redis: {
      host: process.env.REDIS_HOST || 'redis',
      port: process.env.REDIS_PORT || 6379
    }
  },
  workerConcurrency = process.env.WORKER_CONCURRENCY || 4;

let queue = null; // singleton queue

module.exports = {
  // mount kue UI
  mountUI() {
    const port = process.env.KUE_UI_PORT || 3002;
    kue.app.listen(port, () => console.info('kue ui mounted at /'));
  },

  // configure kue and prepare job handlers
  boot(jobHandlers) {
    if (queue)
      throw new Error('boot has already been called');

    console.info('Worker concurrency: %s', workerConcurrency);

    queue = kue.createQueue(kueConfig);

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

    // prepare to process jobs
    jobHandlers.forEach((handler, jobName) => {
      queue.process(jobName, workerConcurrency, (job, done) => {
        handler(job.data.options, done);
      });
    });
  },

  // create a job
  create(name, options) {
    queue = queue || kue.createQueue(kueConfig);

    const job = queue.create(name, {
      title: name, // for kue UI
      options
    });

    job
      .priority(options.priority || 'normal')
      // could use batch cleanup routine but this is fine for now
      .removeOnComplete(process.env.NODE_ENV === 'production')
      .attempts(1)
      // .backoff( { delay: 60 * 1000, type: 'fixed' } )
      // de-activate if worker doesn't process in x mins
      .ttl(30/*min*/ * 60 * 1000)
      .save(err => {
        if (err) console.error('Job not saved:', job.id, err);
      });
  }
};
