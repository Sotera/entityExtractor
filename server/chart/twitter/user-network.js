require('dotenv').config({silent: true});

'use strict';
const _ = require('lodash'),
  ptools = require('../../../server/util/promise-tools'),
  TwitterApi = require('twitter'),
  app = require('../../../server/server'),
  https = require('https');

let twitter_consumer_key = process.env.TWITTER_CONSUMER_KEY,
  twitter_consumer_secret = process.env.TWITTER_CONSUMER_SECRET,
  twitter_bearer_token = process.env.TWITTER_BEARER_TOKEN,
  twitterClient = undefined;

/*
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
twitterClient = new TwitterApi({
  consumer_key: twitter_consumer_key,
  consumer_secret: twitter_consumer_secret,
  bearer_token: twitter_bearer_token
});

module.exports = {

  getClusters: function (clusters) {
    const PostsCluster = app.models.PostsCluster;
    return PostsCluster.find({
      where: {
        id: {inq: clusters}
      },
      fields: ['similar_post_ids']
    });
  },

  getEvent: function (eventId) {
    const Event = app.models.Event;
    return Event.findById(eventId, {
      fields: ['cluster_ids']
    });
  },

  getPostIds: function (clusters) {
    return _(clusters).map('similar_post_ids')
      .flatten().compact().uniq().value();
  },

  getPosts: function (postIds) {
    const SocialMediaPost = app.models.SocialMediaPost;

    return SocialMediaPost.find({
      where: {
        post_id: {inq: postIds}
      },
      fields: ['author_id']
    });
  },


  getAuthorIds: function (posts) {
    let authorIds = _(posts).map('author_id')
      .flatten().compact().uniq().value();
    console.log(authorIds);
    return {authorIds: authorIds};
  },

  getRelationshipData: function (endpoint, user_id) {
    return new Promise((resolve)=> {
      var params = {user_id: user_id};
      twitterClient.get(endpoint, params, function (error, cursor, response) {
        if (error) {
          resolve([]);
          return;
        }

        resolve(cursor.ids);

      });
    });
  },
  getDataForAuthorPromise: function (endpoint, user_id, key, authorRelations) {
    return new Promise((resolve, reject)=> {
      let params = {'user_id': user_id, 'count': 100};
      twitterClient.get(endpoint, params, function (error, cursor) {
        if (error) {
          reject(error.toString());
        }
        let val = {};
        val[user_id] = cursor.ids;
        authorRelations[key].push(val);
        resolve(authorRelations);
      });
    });
  },
  getDataForAuthors: function (endpoint, key, authorRelations) {
    authorRelations.authorIds = [authorRelations.authorIds[0], authorRelations.authorIds[1], authorRelations.authorIds[2]];
    authorRelations[key] = [];

    return new Promise((resolve, reject)=> {
      let promiseChain = Promise.resolve();
      for (let user_id of authorRelations.authorIds) {
        promiseChain = promiseChain
          .then(() => this.getDataForAuthorPromise(endpoint, user_id, key, authorRelations))
          .then(() => ptools.delay(1))
      }
      promiseChain.then(()=> {
        resolve(authorRelations);
      })
        .catch(function (reason) {
          reject(reason);
        });
    });
  },
  execute: function (filter, cb) {
    if (!twitterClient) {
      cb(null, {message: "twitter client not ready"});
      return;
    }
    this.getEvent(filter.eventid)
      .then(event=>this.getClusters(event.cluster_ids))
      .then(clusters=>this.getPostIds(clusters))
      .then(postIds=>this.getPosts(postIds))
      .then(posts=>this.getAuthorIds(posts))
      .then(authorRelations=>this.getDataForAuthors('friends/ids', 'follows', authorRelations))
      .then(authorRelations=>this.getDataForAuthors('followers/ids', 'followers', authorRelations))
      .then(authorRelations=>cb(null, authorRelations))
      .catch(function (reason) {
        console.log(reason);
      });
    //.then(authorRelations=>this.getNetwork(authorRelations));
  }
};

/*var params = {screen_name: filter.userid};
 twitterClient.get('followers/ids', params, function(error, cursor, response) {
 if (error) {
 cb(null, error);
 return;
 }

 cb(null,cursor.ids);

 });*/
/*
 function getEvent(eventId) {
 const Event = Twitter.app.models.Event;
 return Event.findById(eventId,{
 fields: ['cluster_ids']
 });
 }

 function getClusters(event){
 const PostsCluster = Twitter.app.models.postsCluster;
 let similarPostIds = _(clusters).map('similar_post_ids')
 .flatten().compact().uniq().value();

 similarPostIds = _.sampleSize(similarPostIds, sampleSize);

 return PostsCluster.find({
 where: {
 post_id: { inq: event.cluster_ids }
 },
 fields: ['similarPostIds']
 }).$promise;
 }

 Twitter.followerNetwork = function(id,cb){
 if(!twitterReady){
 cb(null,{message:"twitter client not ready"});
 return;
 }

 getEvent(id)
 .then(event=>{
 cb(null,{message:event.name});
 return;
 })
 };
 * */




