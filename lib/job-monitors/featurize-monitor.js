'use strict';

const EventedMonitor = require('./evented-monitor'),
  redis = require('../redis'),
  _ = require('lodash'),
  debug = require('debug')('job-monitor:featurize')
;

// def: subclassed monitor for handling featurizer jobs
class FeaturizeMonitor extends EventedMonitor {
  constructor(jobMonitor, app) {
    super(jobMonitor, app);
    this.initialState = 'preprocessed';
    this.finalState = 'featurized';
    this.keyPrefix = this.jobPrefix + 'feature:';
  }

  submitJobs() {
    return this.scrollSubmit();
  }

  // NOTE: text monitors should specify lang
  getQueryFilter(state) {
    let query = super.getQueryFilter(state);
    if (this.featurizer === 'text')
      query.lang = this.lang;
    return query;
  }

  _submit(post) {
    // use post.id for later db queries by PK
    const key = this.keyPrefix + post.id;
    let jobAttrs, skip = false, queueName = this.jobPrefix;

    switch(this.featurizer) {
      case 'image':
        if (!_.isEmpty(post.primary_image_download_path)) {
          jobAttrs = { state: 'new', image_path: post.primary_image_download_path };
          queueName += 'feature_img';
        } else {
          skip = true;
        }
        break;
      case 'text':
        jobAttrs = { state: 'new', txt: post.text, lang: post.lang };
        queueName += 'feature_txt';
        break;
      case 'domain':
        // start the 'null' featurizer pass-thru
        jobAttrs = { state: 'new', type: 'featurizer' };
        queueName += 'feature_domain';
        break;
      case 'hashtag':
        // start the 'null' featurizer pass-thru
        jobAttrs = { state: 'new', type: 'featurizer' };
        queueName += 'feature_hash';
        break;
      default:
        throw new Error('unknown featurizer');
    }

    if (skip) return;

    return redis
    .hmset(key, jobAttrs)
    // .then(() => redis.publish(queueName, key))
    .then(() => redis.lpush(queueName, key))
    .then(() => this.queue.add(key))
    .then(() => debug('%s submitted', key))
    .catch(err => console.error(key, err.stack));
  }

  onJobComplete(key, output) {
    let updateAttrs, skip = false;
    switch(this.featurizer) {
      case 'image':
        if (!_.isEmpty(output)) {
          updateAttrs = {
            image_features: output.features
          };
        } else {
          skip = true;
        }
        break;
      case 'text':
        updateAttrs = { text_features: output };
        break;
      case 'domain':
      case 'hashtag':
        skip = true;
        break;
      default:
        throw new Error('unknown featurizer');
    }

    //TODO: update record w/o query + update. Loopback doesn't support?
    if (!skip) {
      this.monitoredModel
      .findById(key.replace(this.keyPrefix, ''))
      .then(post => post.updateAttributes(updateAttrs))
      .catch(err => console.error(err.stack));
    }
  }
}


module.exports = FeaturizeMonitor;
