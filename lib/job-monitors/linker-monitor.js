'use strict';

const EventedMonitor = require('./evented-monitor'),
  redis = require('../redis'),
  _ = require('lodash'),
  util = require('util'),
  API_ROOT = process.env.API_ROOT
;

if (!API_ROOT) throw new Error('undefined API_ROOT env var');

// def: subclassed monitor for handling clusterizer jobs
class LinkerMonitor extends EventedMonitor {
  constructor(jobMonitor, app) {
    super(jobMonitor, app);
    this.initialState = 'new';
    this.finalState = 'done';
    this.keyPrefix = this.jobPrefix + 'linker:';
  }

  getItemsCount() {
    return this.app.models.PostsCluster.count(this.getQueryFilter());
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
      queryUrl = util.format('%s/postsclusters/', API_ROOT),
      resultUrl = util.format('%s/clusterlinks/', API_ROOT);

    let channelName = this.jobPrefix;

    const jobAttrs = {
      state: 'new',
      job_id: this.id,
      query_url: queryUrl,
      result_url: resultUrl,
      start_time_ms: this.start_time,
      end_time_ms: this.end_time
    };
    //TODO
    channelName += 'linker';

    return redis
    .hmset(key, jobAttrs)
    .then(() => redis.publish(channelName, key))
    .then(() => this.queue.add(key))
    .then(() => console.info('%s submitted', key))
    .catch(err => console.error(key, err, err.stack));
  }

  onJobComplete(key, output) {
    // service updates clusterlinks so
    // nothing to do here.
  }
}

module.exports = LinkerMonitor;
