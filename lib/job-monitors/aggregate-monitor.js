'use strict';

const EventedMonitor = require('./evented-monitor'),
  redis = require('../redis'),
  _ = require('lodash'),
  debug = require('debug')('job-monitor:aggregate'),
  API_ROOT = process.env.API_ROOT
  ;


// def: subclassed monitor for handling clusterizer jobs
class AggregateMonitor extends EventedMonitor {
  constructor(jobMonitor, app) {
    if (!API_ROOT) throw new Error('undefined API_ROOT env var');
    super(jobMonitor, app);
    this.initialState = 'clustered';
    this.finalState = 'done';
    this.keyPrefix = this.jobPrefix + 'aggregate:';
  }

  submitJobs() {
    const key = this.generateJobKey(),
      serviceArgs = this.jobMonitor.service_args || {},
      queryUrl = `${API_ROOT}/postsclusters/`,
      resultUrl = `${API_ROOT}/aggregateclusters/`,
      maxTimeLapseMs = serviceArgs.max_time_lapse_ms || 1000*60*60*8, //hrs
      simThreshold = serviceArgs.similarity_threshold ||
        process.env.SIMILARITY_THRESHOLD || 0.5;
      ;

    let channelName = this.jobPrefix + 'clust_agg';

    const jobAttrs = {
      state: 'new',
      job_id: this.id,
      query_url: queryUrl,
      result_url: resultUrl,
      max_time_lapse_ms: maxTimeLapseMs,
      end_time_ms: this.end_time,
      data_type: this.featurizer,
      similarity_threshold: simThreshold
    };

    if (this.featurizer === 'text') {
      jobAttrs.lang = this.lang;
    }
    else if (this.featurizer === 'image') {}
    else if (this.featurizer === 'hashtag') {}
    else
      throw new Error('unknown featurizer');

    return redis
      .hmset(key, jobAttrs)
      .then(() => redis.publish(channelName, key))
      .then(() => this.queue.add(key))
      .then(() => debug('%s submitted', key))
      .catch(err => console.error(key, err.stack));
  }

  onJobComplete(key, output) {
    // service updates aggregateclusters. nothing to do here.
  }
}

module.exports = AggregateMonitor;
