'use strict';

const _ = require('lodash'),
  preprocessor = require('../../lib/preprocessors/twitter');

// def: QCR endpoint to inspect post data
// and create SocialMediaPost entries.
module.exports = function(Qcr) {
  Qcr.remoteMethod(
    'insert',
    {
      description: 'QCR endpoint to receive posts',
      http: { path: '/insert', verb: 'post' },
      accepts: {
        arg: 'req',
        type: 'object',
        description: 'the post data',
        http: { source: 'req' }
      },
      returns: { type: 'object', root: true }
    }
  );

  Qcr.insert = function(req, cb) {
    const attrs = req.body;
    // stop the deluge
    if (+process.env.IGNORE_QCR) {
      return cb(null, attrs); // send 200 code and stop
    }
    let qcrData = new Qcr(attrs);

    qcrData.isValid(valid => {
      valid ? save(attrs, cb) : cb(qcrData.errors);
    });
  };

  function save(attrs, cb) {
    const SocialMediaPost = Qcr.app.models.SocialMediaPost;

    let createActions = [],
      processedAttrs = {};

    _.merge(processedAttrs, attrs);

    // QCR-specific modifications
    processedAttrs.state = 'new';
    processedAttrs.timestamp_ms = +(new Date(attrs.timestamp_ms));
    processedAttrs.text = attrs.text || '';
    processedAttrs.image_urls = attrs.image_urls || [];
    processedAttrs.hashtags = attrs.hashtags || [];

    // Twitter-specific modifications
    processedAttrs = preprocessor(processedAttrs);
    delete processedAttrs.quoted_status;

    if (processedAttrs.text.length > 0) {
      processedAttrs.featurizer = 'text';
      createActions.push(SocialMediaPost.create(processedAttrs));
    }
    if (processedAttrs.image_urls.length > 0) {
      processedAttrs.featurizer = 'image';
      createActions.push(SocialMediaPost.create(processedAttrs));
    }
    if (processedAttrs.hashtags.length > 0) {
      processedAttrs.featurizer = 'hashtag';
      createActions.push(SocialMediaPost.create(processedAttrs));
    }

    // returns default 200 for everything.
    // if nil text, hashtags, and images just forget about it.
    Promise.all(createActions)
    .then(() => cb(null, attrs)) // echo input
    .catch(cb);
  }

};
