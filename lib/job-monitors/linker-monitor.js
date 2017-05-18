'use strict';

const EventedMonitor = require('./evented-monitor'),
  _ = require('lodash'),
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
        throw new Error(`unknown monitor state ${this.state} for ${this.id}`);
    }
  }

  submitJobs() {
    const key = this.generateJobKey(),
      serviceArgs = this.jobMonitor.service_args || {},
      queryUrl = `${API_ROOT}/postsclusters/`,
      resultUrl = `${API_ROOT}/clusterlinks/`,
      minOverlap = serviceArgs.min_overlap || process.env.MIN_OVERLAP || 0.6;

    let queueName = this.jobPrefix;

    const job = {
      state: 'new',
      job_id: this.id,
      query_url: queryUrl,
      result_url: resultUrl,
      start_time_ms: this.start_time,
      end_time_ms: this.end_time,
      min_overlap: minOverlap
    };

    queueName += 'linker';

    return this.enqueue(key, job, queueName);
  }

  onJobComplete(key, output) {
    // service updates clusterlinks. nothing to do here.
  }
}

module.exports = LinkerMonitor;
