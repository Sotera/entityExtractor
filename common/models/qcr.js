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
  let postPerSecondTarget = -1;
  let postPerSecondDelta = 0;
  let postPerSecondCount = 0;
  let filteredPostCount = 0;
  let fpps = 0;
  let pps = 0;
  let failures = 0;
  let postsIgnored = 0;
  let stupidDupeSet = new Set();
  let postAge = 0;

  Qcr.setFilter = function(args, cb) {
    //should we have to parse this?
    let f = JSON.parse(args);
    postPerSecondTarget = +f.target;
    //reset counters and start time for pps calculation
    filteredPostCount = 0;
    postPerSecondCount = 0;
    bootTime = Date.now();
    if(f.target <0)
      debug('Filter off!');
    else
      debug('Setting target post per second count to ' + f.target + ' posts');
    cb(null, 'Posts Per Second count set to: ' + f.target);
  };

  Qcr.remoteMethod('setFilter', {
    accepts: {arg: 'filter', type: 'string'},
    returns: {arg: 'result', type: 'string'}
  });


  let stupidDupeInterval = 10000;
  let interval = setInterval(function(){
    debug("clearing dupe set...");
    stupidDupeSet.clear();
  },stupidDupeInterval);


  Qcr.setDupeInterval = function(args, cb) {
    //should we have to parse this?
    let f = JSON.parse(args);
    stupidDupeInterval = +f.target;
    clearInterval(interval);

    interval = setInterval(function(){
      debug("clearing dupe set...");
      stupidDupeSet.clear();
    },stupidDupeInterval);

    debug('Set dupe clear interval to: ' + f.target);
    cb(null, 'Set dupe clear interval to: ' + f.target);
  };

  Qcr.remoteMethod('setDupeInterval', {
    accepts: {arg: 'interval', type: 'string'},
    returns: {arg: 'result', type: 'string'}
  });

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
      pps = postPerSecondCount / ((Date.now() - bootTime)/1000);
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

    debug("qcr dupes over the last 5 seconds: " + failures );
    debug("dupes ignored over the last 5 seconds: " + postsIgnored);
    debug("dupe list size:" + stupidDupeSet.size);
    debug("Average Post Age: " + avgAge);

    postsIgnored = 0;
    failures = 0;
  },5000);

  Qcr.insert = function(req, cb) {
    const attrs = req.body;


    // stop the deluge
    if (+process.env.IGNORE_QCR) {
      return cb(null, attrs); // send 200 code and stop
    }

    //--------------------------------------------------------------------------
    //TODO:get rid of this silly crap when we aren't being sent a load of dupes
    let postId = attrs['post_id'];
    if(stupidDupeSet.has(postId)){
      postsIgnored++;
      return cb(null, attrs); // send 200 code and stop
    }
    stupidDupeSet.add(postId);
    //BLAH!!!
    //--------------------------------------------------------------------------


    if((Date.now() - new Date(attrs['timestamp_ms']).getTime())/1000 > 259200)
      return cb(null, attrs);

    //TODO: either make our system scale correctly or fix this to be less hacky!
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
    //TODO: END either make our system scale correctly or fix this to be less hacky!

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
    .catch(err => {
      // QCR re-sends tweets on 5xx (server error) http response codes.
      // b/c they send lots of dupe tweets, we get mongo uniq idx failures.
      // ignore them.
      // console.error('QCR err:', err);
      failures++;
      cb(null, {ok: 1}); // send bogus 200 response
    });
  }

};
