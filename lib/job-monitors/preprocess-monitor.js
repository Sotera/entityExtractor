'use strict';

const EventedMonitor = require('./evented-monitor'),
  redis = require('../redis'),
  _ = require('lodash')
;

// def: subclassed monitor for handling pre-featurizer jobs
class PreprocessMonitor extends EventedMonitor {
  constructor(jobMonitor, app) {
    super(jobMonitor, app);
    this.initialState = 'new';
    this.finalState = 'preprocessed';
    this.keyPrefix = this.jobPrefix + 'preprocess:';
  }

  submitJobs() {
    const PER_PAGE = 50,
      context = this;
    let _count = 0;

    return this.monitoredModel.count(this.getQueryFilter())
    .then(count => {
      console.info('found %d posts to submit', count);
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

  _submit(post) {
    // use post.id for later db queries by PK
    const key = this.keyPrefix + post.id;
    let jobAttrs, channelName = this.jobPrefix + 'fetch_image';

    switch(this.featurizer) {
      case 'image':
        let image_urls = post.image_urls.map(url => url.expanded_url).join(',');
        jobAttrs = { state: 'new', urls: image_urls };
        break;
      case 'text', 'hashtag':
        // the service instantly finishes jobs with empty []
        jobAttrs = { state: 'new', urls: [] };
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
        if (!_.isEmpty(output)) {
          updateAttrs = {
            primary_image_url: output.url,
            primary_image_download_path: output.path
          };
        }
        break;
      case 'text', 'hashtag':
        // a hint to skip updating
        updateAttrs = {};
        break;
      default:
        throw new Error('unknown featurizer');
    }

    //TODO: update record w/o query + update. Loopback doesn't support?
    if (!_.isEmpty(updateAttrs)) {
      this.monitoredModel
      .findById(key.replace(this.keyPrefix, ''))
      .then(post => post.updateAttributes(updateAttrs))
      .catch(err => console.error(err.stack));
    }
  }
}


module.exports = PreprocessMonitor;
