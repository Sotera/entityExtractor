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

  // get state + data of a redis job by id.
  Job.status = function(args, cb) {
    Job.get(args.job_id)
      .then(job => cb(null, job))
      .catch(err => cb(err));
  };

  Job.get = function(jobId) {
    return redis.hgetall(jobId)
      .then(job => _.pick(job, ['state', 'data', 'error']));
  };
};
