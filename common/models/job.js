'use strict';

const redis = require('../../lib/redis'),
  _ = require('lodash'),
  idGen = require('../../server/util/id-generator');

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

  Job.remoteMethod(
    'submit',
    {
      description: 'Submit a background job for processing',
      accepts: {
        arg: 'args',
        type: 'object',
        description: 'object with properties "job_type" + misc. job attrs',
        required: true,
        http: { source: 'body' }
      },
      returns: {type: 'object', root: true},
      http: {path: '/submit', verb: 'post'}
    }
  );

  // submit a job for processing.
  // args: redis job attrs.
  // job_type is a redis list being watched.
  Job.submit = function(args, cb) {
    const key = idGen.randomish(),
      listName = args.job_type;

    delete args.job_type;

    // services expect 'new' state.
    args.state = 'new';

    redis.enqueue(key, args, listName)
      .then(() => cb(null, { job_id: key }))
      .catch(err => cb(err));
  };
};
