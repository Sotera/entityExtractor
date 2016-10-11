'use strict';

const EventedMonitor = require('./evented-monitor'),
  redis = require('../redis'),
  _ = require('lodash'),
  util = require('util'),
  API_ROOT = process.env.API_ROOT
  ;

if (!API_ROOT) throw new Error('undefined API_ROOT env var');

// def: subclassed monitor for handling clusterizer jobs
class AggregateMonitor extends EventedMonitor {
  constructor(jobMonitor, app) {
    super(jobMonitor, app);
    this.initialState = 'clustered';
    this.finalState = 'done';
    this.keyPrefix = this.jobPrefix + 'aggregate:';
  }

  submitJobs() {
    const key = this.generateJobKey(),
      serviceArgs = this.jobMonitor.service_args || {},
      queryUrl = util.format('%s/postsclusters/', API_ROOT),
      resultUrl = util.format('%s/aggregateclusters/', API_ROOT);

    let channelName = this.jobPrefix;

    const jobAttrs = {
      state: 'new',
      job_id: this.id,
      query_url: queryUrl,
      result_url: resultUrl,
      start_time_ms: this.start_time,
      end_time_ms: this.end_time,
      data_type: this.featurizer
    };

    if (this.featurizer === 'text'){
      jobAttrs.lang = this.lang;
    }
    else if (this.featurizer === 'image'){}
    else if (this.featurizer === 'hashtag') {}
    else
      throw new Error('unknown featurizer');

    return redis
      .hmset(key, jobAttrs)
      .then(() => redis.publish(channelName, key))
      .then(() => this.queue.add(key))
      .then(() => console.info('%s submitted', key))
      .catch(err => console.error(key, err, err.stack));
  }

  onJobComplete(key, output) {
    // nothing to do here.
  }
}

module.exports = AggregateMonitor;
