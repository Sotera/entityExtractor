'use strict';

const EventedMonitor = require('./evented-monitor'),
  redis = require('../redis'),
  _ = require('lodash'),
  util = require('util'),
  debug = require('debug')('job-monitor:clusterize'),
  API_ROOT = process.env.API_ROOT
;


// def: subclassed monitor for handling clusterizer jobs
class ClusterizeMonitor extends EventedMonitor {
  constructor(jobMonitor, app) {
    if (!API_ROOT) throw new Error('undefined API_ROOT env var');
    super(jobMonitor, app);
    this.initialState = 'featurized';
    this.finalState = 'done';
    this.keyPrefix = this.jobPrefix + 'cluster:';
  }

  submitJobs() {
    const key = this.generateJobKey(),
      serviceArgs = this.jobMonitor.service_args || {},
      queryUrl = util.format('%s/socialmediaposts/', API_ROOT),
      resultUrl = util.format('%s/postsclusters/', API_ROOT),
      minPost = serviceArgs.min_post || 10,
      simThreshold = serviceArgs.similarity_threshold ||
        process.env.SIMILARITY_THRESHOLD || 0.5;

    let queueName = this.jobPrefix;

    const jobAttrs = {
      state: 'new',
      job_id: this.id,
      query_url: queryUrl,
      result_url: resultUrl,
      similarity_threshold: simThreshold,
      start_time_ms: this.start_time,
      end_time_ms: this.end_time,
      data_type: this.featurizer
    };

    if (this.featurizer === 'text') {
      queueName += 'clust_txt';
      jobAttrs.lang = this.lang;
    } else if (this.featurizer === 'image') {
      queueName += 'clust_img';
    } else if (this.featurizer === 'hashtag') {
      jobAttrs.min_post = minPost;
      queueName += 'clust_hash';
    } else {
      throw new Error('unknown featurizer');
    }

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

module.exports = ClusterizeMonitor;
