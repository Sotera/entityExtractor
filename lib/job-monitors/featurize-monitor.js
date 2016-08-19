'use strict';

const EventedMonitor = require('./evented-monitor'),
  redis = require('../redis'),
  _ = require('lodash')
;

// def: subclassed monitor for handling featurizer jobs
class FeaturizeMonitor extends EventedMonitor {
  constructor(jobMonitor, app) {
    super(jobMonitor, app);
    this.initialState = 'new';
    this.finalState = 'featurized';
    this.keyPrefix = this.jobPrefix + 'feature:';
  }

  submitJobs() {
    const PER_PAGE = 50,
      context = this;
    let _count = 0;

    return this.app.models.SocialMediaPost.count(this.getQueryFilter())
    .then(count => {
      console.info('found %d posts to submit', count);
      return count;
    })
    .then(page)
    .catch(err => console.error(err.stack));

    function page(count) {
      if (_count >= count) return;

      return context.app.models.SocialMediaPost
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

  _submit(post) {
    const key = this.keyPrefix + post.post_id;
    let jobAttrs, channelName = this.jobPrefix;

    switch(this.featurizer) {
      case 'image':
        jobAttrs = { state: 'new', urls: post.image_urls };
        channelName += 'feature_img';
        break;
      case 'text':
        jobAttrs = { state: 'new', txt: post.text, lang: post.lang };
        channelName += 'feature_txt';
        break;
      default:
        throw new Error('unknown featurizer');
    }

    return redis
    .hmset(key, jobAttrs)
    .then(() => redis.publish(channelName, key))
    .then(() => this.queue.add(key))
    .then(() => console.info('%s submitted', key))
    .catch(err => console.error(key, err.stack));
  }

  onJobComplete(key, output) {
    let updateAttrs;
    switch(this.featurizer) {
      case 'image':
        updateAttrs = { image_features: output };
        break;
      case 'text':
        updateAttrs = { text_features: output };
        break;
      default:
        throw new Error('unknown featurizer');
    }

    this.app.models.SocialMediaPost
    .updateAll({
      post_id: key.replace(this.keyPrefix, ''),
      featurizer: this.featurizer
    },
    updateAttrs)
    .catch(err => console.error(err.stack));
  }
}


module.exports = FeaturizeMonitor;
