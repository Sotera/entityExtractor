'use strict';

const EventedMonitor = require('./evented-monitor'),
  redis = require('../redis'),
  _ = require('lodash'),
  debug = require('debug')('job-monitor:preprocess')
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
    let jobAttrs, skip = false, queueName = this.jobPrefix + 'fetch_image';

    switch(this.featurizer) {
      case 'image':
        let image_urls = post.image_urls.map(url => url.expanded_url).join(',');
        if (_.isEmpty(image_urls))
          skip = true;
        else
          jobAttrs = { state: 'new', urls: image_urls };
        break;
      case 'text':
      case 'domain':
      case 'hashtag':
        skip = true;
        break;
      default:
        throw new Error('unknown featurizer');
    }

    if (skip) return;

    // for now, only images get here.
    let submitJob = redis
      .hmset(key, jobAttrs)
      // .then(() => redis.publish(queueName, key))
      .then(() => redis.lpush(queueName, key))
      .then(() => this.queue.add(key))
      .then(() => debug('%s submitted', key))
      .catch(err => console.error(key, err.stack));

    // image already pre-processed?
    // by broadcast_post_id since retweets are majority.
    let getImageMapping = post.broadcast_post_id ?
        ImageMapping.find({ where: {
          post_id: post.broadcast_post_id,
          primary_image_url: { $neq: null }
        }}) :
        Promise.resolve([]);

    return getImageMapping
    .then(mappings => {
      if (!mappings.length)
        return submitJob;

      let mapping = mappings[0],
        // valid object assignment?
        attrs = { primary_image_url, primary_image_download_path } = mapping;
      return this._updateModel(post.id, attrs);
    });

  }

  onJobComplete(key, output) {
    let updateAttrs, skip = false;
    switch(this.featurizer) {
      case 'image':
        if (!_.isEmpty(output)) {
          updateAttrs = {
            primary_image_url: output.url,
            primary_image_download_path: output.path
          };
        } else {
          skip = true;
        }
        break;
      case 'text':
      case 'domain':
      case 'hashtag':
        skip = true;
        break;
      default:
        throw new Error('unknown featurizer');
    }

    //TODO: update record w/o query + update. Loopback doesn't support?
    if (!skip)
      this._updateModel(key.replace(this.keyPrefix, ''), updateAttrs)
        .then(post => this._updateImageMapping(post, updateAttrs));
  }

  _updateModel(id, attrs) {
      this.monitoredModel
      .findById(id)
      .then(post => post.updateAttributes(attrs))
      .catch(err => console.error(err.stack));
  }

  _updateImageMapping(post, imageAttrs) {
    if (post.broadcast_post_id) {
      let attrs = _.assign({ post_id: post.broadcast_post_id }, imageAttrs);
      return this.app.models.ImageMapping.create(attrs)
        .catch(err => console.error(err.stack));
    } else {
      return;
    }
}


module.exports = PreprocessMonitor;
