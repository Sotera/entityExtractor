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

  getEventNetwork: function (eventId) {
    const EventNetwork = app.models.EventNetwork;

    return EventNetwork.findOne({
      where: {
        event_id: eventId
      },
      fields: ['data']
    });
  },

  getAuthorIds: function (posts, eventid) {
    let authorIds = _(posts).map('author_id')
      .flatten().compact().uniq().value();
    console.log(authorIds);
    return {authorIds: authorIds, eventId:eventid};
  },

  getRelationships: function(authorId, authorRelations){
    let relatedTo = [];

    authorRelations.authorIds.forEach(function(otherId){
      if(authorId == otherId){ return;}
      if(_.includes(authorRelations['follows'][otherId],authorId)){relatedTo.push(otherId);}
      if(_.includes(authorRelations['followers'][otherId],authorId)){relatedTo.push(otherId);}
      relatedTo = _(relatedTo).uniq();
    });

    if(relatedTo.length == 0){
      return;
    }
    authorRelations.network.nodes.push({id:authorId});
    relatedTo.forEach(function(otherId){
      authorRelations.network.nodes.push({id:otherId});
      authorRelations.network.links.push({source:authorId, target:otherId});
    });
  },

  getRelationshipData: function (authorRelations, network) {
    let me = this;
    return new Promise((resolve)=> {
      console.log("getting relationship data");
      authorRelations.network = {links:[], nodes:[]};
      authorRelations.authorIds.forEach(function(authorId){
        me.getRelationships(authorId, authorRelations);
      });

      authorRelations.network.nodes = _.uniqWith(authorRelations.network.nodes, _.isEqual);
      authorRelations.network.links = _.uniqWith(authorRelations.network.links, function(a, b){
        if(a.source == b.source && a.target == b.target){return true;}
        if(a.source == b.target && a.target == b.source){return true;}
        return false;
      });

      console.log("saving network");
      network.save({event_id:authorRelations.eventId,status:1, data:authorRelations.network});
      console.log("network saved");
      resolve(authorRelations);
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
        val[user_id] = user_id;
        if(!cursor){
          resolve(authorRelations);
          return;
        }
        val[key] = cursor.ids;
        authorRelations[key].push(val);
        resolve(authorRelations);
      });
    });
  },
  getDataForAuthors: function (endpoints, authorRelations) {
    authorRelations.authorIds = [authorRelations.authorIds[0], authorRelations.authorIds[1], authorRelations.authorIds[2]];

    for(let endpoint of endpoints){
      authorRelations[endpoint.key] = [];
    }

    return new Promise((resolve, reject)=> {
      let promiseChain = Promise.resolve();
      for (let user_id of authorRelations.authorIds) {
        for(let endpoint of endpoints){
          promiseChain = promiseChain
            .then(() => this.getDataForAuthorPromise(endpoint.endpoint, user_id, endpoint.key, authorRelations))
        }
        promiseChain = promiseChain
          .then(() => ptools.delay(61))
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

    //check to see if we have already built this network
    this.getEventNetwork(filter.eventid)
      .then(network=>{
        if(!network || network.status <= 0){
          cb(null, "working");
          if(!network) {
            const EventNetwork = app.models.EventNetwork;
            EventNetwork.create({event_id: filter.eventid, status: 0, data: {}});
          }
          //we haven't, bummer, lets get to work :(
          this.getEvent(filter.eventid)
            .then(event=>this.getClusters(event.cluster_ids))
            .then(clusters=>this.getPostIds(clusters))
            .then(postIds=>this.getPosts(postIds))
            .then(posts=>this.getAuthorIds(posts, filter.eventid))
            .then(authorRelations=>this.getDataForAuthors([{endpoint:'friends/ids',key:'follows'},{endpoint:'followers/ids',key:'followers'}], authorRelations))
            .then(authorRelations=>this.getRelationshipData(authorRelations, network))
            .catch(function (reason) {
              console.log(reason);
            });
          return;
        }

        cb(null,network);
      });
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




