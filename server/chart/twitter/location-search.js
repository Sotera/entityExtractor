'use strict';

// def: collect user network data from twitter scraper with fallback to twitter api

require('dotenv').config({silent: true});

const _ = require('lodash'),
  TwitterApi = require('twitter'),
  https = require('https'),
  debug = require('debug')('user-network');

let twitter_consumer_key = process.env.TWITTER_CONSUMER_KEY,
  twitter_consumer_secret = process.env.TWITTER_CONSUMER_SECRET,
  twitter_bearer_token = process.env.TWITTER_BEARER_TOKEN

let twitterClient = new TwitterApi({
    consumer_key: twitter_consumer_key,
    consumer_secret: twitter_consumer_secret,
    bearer_token: twitter_bearer_token
  });

module.exports = {

  execute(options, done) {
    debug(options);
    if (!twitterClient) {
      return done(new Error('twitter client not ready'));
    }
    let params = {q: options};
    twitterClient.get('search/tweets', params, function (error, tweets, response) {
      if (error) {
        done(error);
        return;
      }
      done(null,tweets);
    });
  }
};





/*//code used to get bearer token...does not need to be called unless our bearer token is bad.
 if(twitter_consumer_key != undefined && twitter_consumer_secret != undefined){
 let url_tck = encodeURIComponent(twitter_consumer_key);
 let url_tcs = encodeURIComponent(twitter_consumer_secret);
 let tck_tcs = url_tck + ':' + url_tcs;
 let b64_key = new Buffer(tck_tcs).toString('base64');

 var post_data = "grant_type=client_credentials";
 var post_options = {
 host: 'api.twitter.com',
 path: '/oauth2/token',
 method: 'POST',
 headers: {
 'Authorization': 'Basic ' + b64_key,
 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
 'Content-Length': 29,
 'accept': 'application/json',
 'method': 'POST'
 }
 };

 var post_req = https.request(post_options, function(res) {
 res.setEncoding('utf8');
 res.on('data', function (chunk) {
 bearer_token += chunk;
 });
 res.on('end', function(){
 let token = JSON.parse(bearer_token);
 if(token && token.token_type == 'bearer') {
 twitterClient = new TwitterApi({
 consumer_key: twitter_consumer_key,
 consumer_secret: twitter_consumer_secret,
 bearer_token: bearer_token
 });
 }
 });
 });

 post_req.on('error', function(e) {
 console.error(e);
 });

 // post the data
 post_req.write(post_data);
 post_req.end();
 }*/
