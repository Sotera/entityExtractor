'use strict';

const redis = require('../../lib/redis'),
  _ = require('lodash');

module.exports = function(Job) {

  Job.remoteMethod(
    'status',
    {
      description: 'Returns job status and data, if complete',
      accepts: {
        arg: 'args',
        type: 'object',
        description: 'object with properties "job_id"',
        required: true,
        http: { source: 'body' }
      },
      returns: {type: 'object', root: true},
      http: {path: '/status', verb: 'post'}
    }
  );

  // get state, data of a redis job, by user-defined id.
  Job.status = function(args, cb) {
    redis.hgetall(args.job_id)
      .then(data => _.pick(data, ['state', 'data', 'error']))
      .then(data => cb(null, data))
      .catch(err => cb(err));
  };
};
