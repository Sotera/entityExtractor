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
    const PER_PAGE = 50,
      context = this;
    let _count = 0;

    return this.monitoredModel.count(this.getQueryFilter())
    .then(count => {
      console.info('inspecting %d posts', count);
      return count;
    })
    .then(page)
    .catch(err => console.error(err.stack));

    function page(count) {
      if (_count >= count) return;

      return context.monitoredModel
      .find({
        where: context.getQueryFilter(),
        order: 'id asc',
        skip: _count, limit: PER_PAGE
      })
      .then(posts => {
        _count += posts.length;
        return Promise.all(
          posts.map(context._submit, context)
        );
      })
      .then(() => page(count));
    }
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
    let jobAttrs, skip = false, channelName = this.jobPrefix;

    switch(this.featurizer) {
      case 'image':
        if (!_.isEmpty(post.primary_image_download_path)) {
          jobAttrs = { state: 'new', image_path: post.primary_image_download_path };
          channelName += 'feature_img';
        } else {
          skip = true;
        }
        break;
      case 'text':
        jobAttrs = { state: 'new', txt: post.text, lang: post.lang };
        channelName += 'feature_txt';
        break;
      case 'hashtag':
        // start the 'null' featurizer pass-thru
        jobAttrs = { state: 'new', type: 'featurizer' };
        channelName += 'feature_hash';
        break;
      default:
        throw new Error('unknown featurizer');
    }

    if (skip) return;

    return redis
    .hmset(key, jobAttrs)
    .then(() => redis.publish(channelName, key))
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
