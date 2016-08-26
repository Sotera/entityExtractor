// def: find stored feed data and send to ner
'use strict';

const request = require('request'),
  entityExtractor = require('../../lib/entity-extractor'),
  app = require('../../server/server'),
  Extract = app.models.Extract,
  FeedObject = app.models.FeedObject,
  SocialMediaPost = app.models.SocialMediaPost,
  _ = require('lodash'),
  WAIT = 30; //seconds

const worker = module.exports = {
  start() {
    run();
    // recursively run, with a wait period
    function run() {
      FeedObject.findOne({ where: { processed: false } })
      .then(markAsProcessed) // even if we fail later lets continue with the next item
      .then(extract)
      .then(feedObject => {
        if (!feedObject) {
          // if no more items, lets take a break
          console.log('waiting for new feed data...');
          setTimeout(run, WAIT * 1000);
        } else {
          run();
        }
      })
      .catch(err => {
        console.error(err);
        run(); // keep going
      });
    }
  }
};

// start if run as a worker process
if (require.main === module)
  worker.start();

function extract(feedObject) {
  if (!feedObject) return;
  console.log('Extract object with guid', feedObject.guid);
  return eventize(feedObject).then(() => feedObject);
}

function eventize(feedObject) {
  // TODO: abstract flickr specifics
  var extractType = _.capitalize(feedObject.extractType);
  if (extractType === 'Neuraltalk2') { // images
    // photo id is part of guid
    var photoId = /[0-9]+$/.exec(feedObject.guid)[0];
    return entityExtractor.eventizeWithNeuralTalk2(
      feedObject.enclosures[0].url,
      { text: feedObject.title,
        date: feedObject['flickr:date_taken']['#'],
        link: feedObject.link,
        photoId
      }
    );
  } else { // text
    // TODO: obj.description ok? is it truncated in some feeds? etc.
    return entityExtractor['eventizeWith' +
      extractType](feedObject.description,
        { date: feedObject.pubdate, mimeType: 'text/html' });
  }
}

function markAsProcessed(feedObject) {
  if (!feedObject) {
    return;
  } else {
    console.log('Processing:', feedObject.guid);
    var socialMediaPost = {
      "post_id": feedObject.id,
      "post_type": "watchman",
      "post_url": feedObject.link,
      "text": feedObject.title,
      "lang": "en",
      "featurizer": "text",
      "timestamp_ms": new Date(feedObject.pubdate).getTime()
    };
    SocialMediaPost.create(socialMediaPost);
    return feedObject.updateAttributes({processed: true});
  }
}
