'use strict';

const EventedMonitor = require('./evented-monitor'),
  _ = require('lodash'),
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
      queryUrl = `${API_ROOT}/socialmediaposts/`,
      resultUrl = `${API_ROOT}/postsclusters/`,
      minPost = serviceArgs.min_post || 10,
      simThreshold = serviceArgs.similarity_threshold ||
        process.env.SIMILARITY_THRESHOLD || 0.5;

    let queueName = this.jobPrefix;

    const job = {
      state: 'new',
      job_id: this.id,
      query_url: queryUrl,
      result_url: resultUrl,
      similarity_threshold: simThreshold,
      start_time_ms: this.start_time,
      end_time_ms: this.end_time,
      data_type: this.featurizer
    };

    switch(this.featurizer) {
      case 'image':
        queueName += 'clust_img';
        break;
      case 'text':
        job.min_post = minPost;
        queueName += 'clust_txt';
        break;
      case 'hashtag':
        job.min_post = minPost;
        queueName += 'clust_hash';
        break;
      default:
        throw new Error(`unknown featurizer: ${this.featurizer}`);
    }

    return this.enqueue(key, job, queueName);
  }

  onJobComplete(key, output) {
    // service updates clusterlinks. nothing to do here.
  }
}

module.exports = ClusterizeMonitor;
