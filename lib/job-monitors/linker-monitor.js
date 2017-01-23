'use strict';

const EventedMonitor = require('./evented-monitor'),
  redis = require('../redis'),
  _ = require('lodash'),
  util = require('util'),
  debug = require('debug')('job-monitor:linker'),
  API_ROOT = process.env.API_ROOT
;


// def: subclassed monitor for handling cluster linker jobs
class LinkerMonitor extends EventedMonitor {
  constructor(jobMonitor, app) {
    if (!API_ROOT) throw new Error('undefined API_ROOT env var');
    super(jobMonitor, app);
    this.initialState = 'new';
    this.finalState = 'done';
    this.monitoredModel = this.app.models.PostsCluster;
    this.keyPrefix = this.jobPrefix + 'linker:';
  }

  getQueryFilter() {
    return {
      end_time_ms: {
        between: [this.start_time, this.end_time]
      }
    };
  }

  getNextState(prevState) {
    switch (prevState || this.state) {
      case 'new':
        return 'done';
        break;
      default:
        throw new Error(
          util.format('unknown monitor state %s for %s',
          this.state, this.id)
        );
    }
  }

  submitJobs() {
    const key = this.generateJobKey(),
      serviceArgs = this.jobMonitor.service_args || {},
      queryUrl = util.format('%s/postsclusters/', API_ROOT),
      resultUrl = util.format('%s/clusterlinks/', API_ROOT),
      minOverlap = serviceArgs.min_overlap || process.env.MIN_OVERLAP || 0.6;

    let queueName = this.jobPrefix;

    const jobAttrs = {
      state: 'new',
      job_id: this.id,
      query_url: queryUrl,
      result_url: resultUrl,
      start_time_ms: this.start_time,
      end_time_ms: this.end_time,
      min_overlap: minOverlap
    };

    queueName += 'linker';

    return redis
    .hmset(key, jobAttrs)
    // .then(() => redis.publish(queueName, key))
    .then(() => redis.lpush(queueName, key))
    .then(() => this.queue.add(key))
    .then(() => debug('%s submitted', key))
    .catch(err => console.error(key, err.stack));
  }

  onJobComplete(key, output) {
    // service updates clusterlinks. nothing to do here.
  }
}

module.exports = LinkerMonitor;
