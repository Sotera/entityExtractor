'use strict';

const redis = require('../redis'),
  _ = require('lodash'),
  debug = require('debug')('job-monitor:inspector'),
  ptools = require('../../server/util/promise-tools')
;

// def: inspect running jobs via redis and handle output
module.exports = class JobInspector {
  constructor(args) {
    this.key = args.key;
    this.queue = args.queue; // optional set
    this.onComplete = args.onComplete;
    this.onError = args.onError || console.error;
    this.stopPolling = false; // used when poll() is invoked
    this.autoClean = true; // del key on complete, error
  }

  // check job once
  run() {
    return redis.hgetall(this.key)
    .then(data => {
      if (!data) {
        console.error('%s not found', this.key);
        if (this.queue) this.queue.delete(this.key);
        this.stopPolling = true;
        this.onError('job not found');
      } else if (data.state === 'processed') {
        let output = data.data;
        if (_.isEmpty(output)) {
          console.error('%s is missing data', this.key);
        } else {
          debug('%s processed', this.key);
          if (typeof output === 'string')
            output = JSON.parse(output);

          this.onComplete(this.key, output);
        }
        if (this.queue) this.queue.delete(this.key);
        this.stopPolling = true;
        if (this.autoClean) redis.del(this.key); //good citizen cleanup
      } else if (data.state === 'error') {
        console.error('%s reported an error: %s', this.key, data.error);
        if (this.queue) this.queue.delete(this.key);
        this.stopPolling = true;
        if (this.autoClean) redis.del(this.key); //good citizen cleanup
        this.onError(this.key, data.error);
      } else {
        debug('not finished: %s state: %s', this.key, data.state);
      }
    })
    .catch(err => {
      console.error('polling err for %s', this.key, err.stack);
      if (this.queue) this.queue.delete(this.key);
      if (this.autoClean) redis.del(this.key); //good citizen cleanup
      this.stopPolling = true;
    });
  }

  // poll until job is finished
  poll(waitIntervalMs=1000) {
    if (this.stopPolling) return;
    return this.run()
    .then(() => ptools.delay(waitIntervalMs/1000.0))
    .then(() => this.poll(waitIntervalMs));
  }
};




