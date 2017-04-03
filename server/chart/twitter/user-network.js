'use strict';

// def: collect user network data from twitter scraper with fallback to twitter api

require('dotenv').config({silent: true});

const _ = require('lodash'),
  ptools = require('../../../server/util/promise-tools'),
  TwitterApi = require('twitter'),
  app = require('../../../server/server'),
  https = require('https'),
  redis = require('../../../lib/redis'),
  idGen = require('../../../server/util/id-generator');

let twitter_consumer_key = process.env.TWITTER_CONSUMER_KEY,
  twitter_consumer_secret = process.env.TWITTER_CONSUMER_SECRET,
  twitter_bearer_token = process.env.TWITTER_BEARER_TOKEN,
  twitter_scrape_method = process.env.TWITTER_SCRAPE_METHOD || "follow_along",//follow_along or twitter
  max_twitter_count = +process.env.MAX_TWITTER_COUNT || 200,
  twitterClient = undefined;

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
      fields: ['author_id','screen_name']
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
    let authorKey = twitter_scrape_method === 'twitter'?'author_id':'screen_name';
    let authorIds = _(posts).map(authorKey)
      .flatten().compact().uniq().value();
    console.log(authorIds);
    return {authorIds: authorIds, eventId:eventid};
  },
  getHash: function(str){
    let hash = 0, i, chr;
    if (str.length === 0) return hash;
    for (i = 0; i < str.length; i++) {
      chr   = str.charCodeAt(i);
      hash  = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  },
  getRelationships: function(authorId, authorRelations){
    let me = this;
    let relatedTo = [];

    let follows = authorRelations['follows'][authorId];
    let followers = authorRelations['followers'][authorId];

    authorRelations.authorIds.forEach(function(otherId){
      if(authorId == otherId){ return;}
      if(_.includes(follows,otherId)){relatedTo.push(otherId);}
      if(_.includes(followers,otherId)){relatedTo.push(otherId);}
    });

    if(relatedTo.length == 0){
      return;
    }

    relatedTo = _(relatedTo).uniq().value();
    let authorHash = me.getHash(authorId);
    authorRelations.network.nodes.push({
      id:authorHash,
      name:authorId
    });
    _.each(relatedTo,function(otherId){
      authorRelations.network.nodes.push({
        id:me.getHash(otherId),
        name:otherId
      });
      authorRelations.network.links.push({source:authorHash, target:me.getHash(otherId)});
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
      network.event_id = authorRelations.eventId;
      network.status = 1;
      network.data = authorRelations.network;
      network.save(function(err,obj){
        if(err){
          console.log(err);
          network = obj;
        }
      });
      console.log("network saved");
      resolve(authorRelations);
    });
  },
  getDataForAuthorPromise: function (endpoint, user_id, key, authorRelations) {
    return new Promise((resolve)=> {
      let params = {'user_id': user_id, 'count': max_twitter_count};
      twitterClient.get(endpoint, params, function (error, cursor) {
        if (error || !cursor) {
          resolve(authorRelations);
          return;
        }
        authorRelations[key][user_id] =cursor.ids.map(String);
        resolve(authorRelations);
      });
    });
  },
  getDataForAuthorRedisPromise: function (endpoint, user_id, key, authorRelations) {
    return new Promise((resolve)=> {
      let params = {'id': user_id, 'state':'new', 'max':max_twitter_count};
      redis.hmset(user_id, params)
      .then(() =>{
        redis.lpush('genie:followfinder', user_id)
        .then(()=>{
          let interval = setInterval(function(){
            redis.hgetall(user_id).then(data=>{
              if(!data) return;
              if(data.state === 'new') return;
              clearInterval(interval);
              if(data.state === 'error') return;
              authorRelations[key][user_id] = data.data.split(',');
              resolve(authorRelations);
            }).catch(err => {
              console.log(err);
              resolve(authorRelations);
            });
          },100);
        });
      })
        .catch(err => console.error(key, err.stack));


    });
  },
  getDataForAuthors: function (endpoints, authorRelations, network) {
    //authorRelations.authorIds = authorRelations.authorIds.slice(0,60);

    for(let endpoint of endpoints){
      authorRelations[endpoint.key] = {};
    }

    return new Promise((resolve, reject)=> {
      let promiseChain = Promise.resolve();
      for (let user_id of authorRelations.authorIds) {
        for(let endpoint of endpoints){
          if(twitter_scrape_method === 'twitter') {
            promiseChain = promiseChain
              .then(() => this.getDataForAuthorPromise(endpoint.endpoint, user_id, endpoint.key, authorRelations))
          } else{
            promiseChain = promiseChain
              .then(() => this.getDataForAuthorRedisPromise(endpoint.endpoint, user_id, endpoint.key, authorRelations))
          }
        }
        promiseChain = promiseChain
        .then(authorRelations=>this.getRelationshipData(authorRelations, network));
        if(twitter_scrape_method === 'twitter'){
          promiseChain = promiseChain
            .then(() => ptools.delay(61))
        } else{
          promiseChain = promiseChain
            .then(() => ptools.delay(0))
        }
      }
      promiseChain.then(()=> {
        resolve(authorRelations);
      })
        .catch(function (reason) {
          console.log(reason + " :continuing...");
          resolve(authorRelations);
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
            EventNetwork.create({event_id: filter.eventid, status: 0, data: {}}, function (err,obj){
              network = obj;
            });
          }
          //we haven't, bummer, lets get to work :(
          this.getEvent(filter.eventid)
            .then(event=>this.getClusters(event.cluster_ids))
            .then(clusters=>this.getPostIds(clusters))
            .then(postIds=>this.getPosts(postIds))
            .then(posts=>this.getAuthorIds(posts, filter.eventid))
            .then(authorRelations=>this.getDataForAuthors([{endpoint:'friends/ids',key:'follows'},{endpoint:'followers/ids',key:'followers'}], authorRelations, network))
            .catch(function (reason) {
              console.log(reason);
            });
          return;
        }

        cb(null,network);
      });
  }
};





