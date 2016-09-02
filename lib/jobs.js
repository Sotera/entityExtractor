'use strict';

const redis = require('./redis'),
  _ = require('lodash'),
  kue = require('kue'),
  kueConfig = {
    jobEvents: false,
    redis: {
      host: 'redis'
    }
  },
  queue = kue.createQueue(kueConfig)
;

module.exports = {
  queue,

  // get state, data of a redis job, by user-defined id.
  // (this pre-dates kue integration, fwiw)
  status(id) {
    return redis.hgetall(id)
    .then(data => _.pick(data, ['state', 'data']));
  },

  // create a kue job
  create(name, options) {
    const job = queue.create(name, {
      title: name, // for kue UI
      options: options
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
