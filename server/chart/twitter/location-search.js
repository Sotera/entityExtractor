'use strict';

// def: search twitter location api

require('dotenv').config({silent: true});

const _ = require('lodash'),
  app = require('../../../server/server'),
  TwitterApi = require('twitter'),
  debug = require('debug')('location-search'),
  JobInspector = require('../../../lib/job-monitors/job-inspector'),
  redis = require('../../../lib/redis'),
  SVC = 'genie:indications';

let twitterClient, ScoredPost; // lazy instantiation

module.exports = {

  execute(options, done) {
    twitterClient = twitterClient || new TwitterApi({
      consumer_key: process.env.TWITTER_CONSUMER_KEY,
      consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
      bearer_token: process.env.TWITTER_BEARER_TOKEN
    });

    ScoredPost = app.models.ScoredPost;

    twitterClient.get('search/tweets', { q: options.qs.loc }, (err, tweets, _) => {
      if (err) return done(err);

      const jobId = options.jobId;

      Promise.all(tweets.statuses.map(tweet => {
        return ScoredPost.create({
          job_id: jobId,
          post_id: tweet.id_str,
          text: tweet.text,
          score_type: SVC
        });
      }))
      .then(() => startJob(jobId))
      .then(() => done(jobId))
      .catch(err => {
        console.error(err);
        done(err);
      });
    });
  }
};

function startJob(jobId) {
  const inspector = new JobInspector({
      key: jobId,
      onComplete: debug,
      autoClean: false // so client can find in /jobs
    }),
    job = { id: jobId, state: 'new' };

  return redis.enqueue(jobId, job, SVC)
  .then(() => inspector.poll(500));
}
