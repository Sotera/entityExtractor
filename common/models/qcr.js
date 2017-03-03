'use strict';

const _ = require('lodash'),
  preprocessor = require('../../lib/preprocessors/twitter'),
  debug = require('debug')('qcr');

// def: QCR endpoint to inspect post data
// and create SocialMediaPost entries.
module.exports = function(Qcr) {

  let bootTime = Date.now();
  let postWindowStart = bootTime;
  let postWindowPostCount = 0;
  let postWindowInterval = 1000;
  let postPerSecondTarget = +process.env.PPS_TARGET || -1;
  let postPerSecondDelta = 0;
  let postPerSecondCount = 0;
  let filteredPostCount = 0;
  let fpps = 0;
  let pps = 0;
  let failures = 0;
  let postsIgnored = 0;
  let dupeSet = new Set();
  let postAge = 0;
  let dupeInterval = +process.env.DUPE_INTERVAL_MS || 10000;

  // ignore posts before this
  let daysBack = +process.env.IGNORE_DAYS_BACK || 3;
  let secondsBack = daysBack * 24 * 60 * 60;

  if(postPerSecondTarget < 0)
    debug('Filter off!');
  else
    debug('post per second target:', postPerSecondTarget);

  let interval = setInterval(() => {
    debug("clearing dupe set...");
    dupeSet.clear();
  }, dupeInterval);

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

  setInterval(function(){
    pps = postPerSecondCount / ((Date.now() - bootTime) / 1000);
    debug('--==PPS==--:' + pps);
    if(postPerSecondTarget>=0) {
      fpps = filteredPostCount / ((Date.now() - bootTime) / 1000);
      debug("--==FPPS==--:" + fpps + " Delta:" + postPerSecondDelta);
    }
    let avgAge = postAge/postPerSecondCount;
    postPerSecondCount = 0;
    filteredPostCount = 0;
    bootTime = Date.now();
    postAge = 0;

    debug("qcr dupes over the last 5 seconds: " + failures);
    debug("dupes ignored over the last 5 seconds: " + postsIgnored);
    debug("dupe list size:" + dupeSet.size);
    debug("Average Post Age: " + avgAge);

    postsIgnored = 0;
    failures = 0;
  }, 5000);

  Qcr.insert = function(req, cb) {
    const attrs = req.body;

    // stop the deluge
    if (+process.env.IGNORE_QCR) {
      return cb(null, attrs); // send 200 code and stop
    }

    //--------------------------------------------------------------------------
    let postId = attrs['post_id'];
    if(dupeSet.has(postId)){
      postsIgnored++;
      return cb(null, attrs); // send 200 code and stop
    }
    dupeSet.add(postId);
    //--------------------------------------------------------------------------

    if((Date.now() - new Date(attrs['timestamp_ms']).getTime())/1000 > secondsBack)
      return cb(null, attrs);

    //TODO: less hacky!
    //Calculating our posts per second so we get a real amount to deal with
    postPerSecondCount ++;
    postAge += (Date.now() - new Date(attrs['timestamp_ms']).getTime())/1000;
    if(postPerSecondTarget >=0){
      postWindowPostCount++;
      if(Date.now() >= postWindowStart + postWindowInterval){
        postWindowStart = Date.now();

        if((fpps - pps) < -.5 && (fpps - postPerSecondTarget) < -.5){
          postPerSecondDelta ++;
        }
        if((fpps - postPerSecondTarget) > .5) postPerSecondDelta --;

        postWindowPostCount = 0;
      }
      if(postWindowPostCount > postPerSecondTarget + postPerSecondDelta){
        return cb(null, attrs);
      }

      filteredPostCount++;
    }
    //TODO: less hacky!

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
    processedAttrs.domains = attrs.domains || [];

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
    // No domain posts until absentfriends is fixed
    // if (processedAttrs.image_urls.length > 0) {
    //   processedAttrs.featurizer = 'domain';
    //   createActions.push(SocialMediaPost.create(processedAttrs));
    // }

    // returns default 200 for everything.
    // if nil text, hashtags, and images just forget about it.
    Promise.all(createActions)
    .then(() => cb(null, attrs)) // echo input
    .catch(err => {
      // QCR re-sends tweets on 5xx (server error) http response codes.
      // b/c they send lots of dupe tweets, we get mongo uniq idx failures.
      // ignore them.
      debug(err);
      failures++;
      cb(null, {ok: 1}); // send bogus 200 response
    });
  }
};
