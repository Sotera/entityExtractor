'use strict';

const _ = require('lodash');

module.exports = preprocess;

// def: if tweet is a 'quoted tweet' append quoted_status attrs.
// https://support.twitter.com/articles/20169873
function preprocess(attrs) {
  let quoted = attrs.quoted_status;

  if (!_.isEmpty(quoted)) {
    let hashtags = _.get(quoted, 'entities.hashtags');
    if (hashtags) {
      attrs.hashtags = attrs.hashtags || [];
      attrs.text = attrs.text || '';
      hashtags = hashtags.map(h => h.text);
      attrs.hashtags = attrs.hashtags.concat(hashtags);
      if (!_.isEmpty(quoted.text)) {
        attrs.text = attrs.text + (' ' + quoted.text);
      }
    }
    
    let media = _.get(quoted, 'entities.media');
    if (media) {
      if (media.length > 0) {
        attrs.image_urls = attrs.image_urls || [];
        let expanded_urls = _.map(media, 'expanded_url');
        if (expanded_urls) {
          attrs.image_urls = attrs.image_urls.concat(expanded_urls);
        }
      }
    }
    
  }

  return attrs;
}
