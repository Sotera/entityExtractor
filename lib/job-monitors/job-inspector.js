'use strict';

const redis = require('../redis'),
  _ = require('lodash'),
  debug = require('debug')('job-monitor:inspector')
;

// def: inspect running jobs via redis and handle output
module.exports = class JobInspector {
  constructor(args) {
    this.key = args.key;
    this.queue = args.queue;
    this.onComplete = args.onComplete;
    this.onError = args.onError || console.error;
  }

  run() {
    return redis.hgetall(this.key)
    .then(data => {
      if (!data) {
        console.error('%s not found', this.key);
        this.queue.delete(this.key);
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
        this.queue.delete(this.key);
        redis.del(this.key); //good citizen cleanup
      } else if (data.state === 'error') {
        console.error('%s reported an error: %s', this.key, data.error);
        this.queue.delete(this.key);
        redis.del(this.key); //good citizen cleanup
        this.onError(this.key, data.error);
      } else {
        debug('unfinished job: %j', data);
        // debug('not finished: %s state: %s', this.key, data.state);
      }
    })
    .catch(err => {
      console.error('polling err for %s', this.key, err.stack);
      this.queue.delete(this.key);
    });
  }
};




