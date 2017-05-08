'use strict';

// def: collect user network data from twitter scraper with fallback to twitter api

require('dotenv').config({silent: true});

const _ = require('lodash'),
  ptools = require('../../../server/util/promise-tools'),
  TwitterApi = require('twitter'),
  app = require('../../../server/server'),
  https = require('https'),
  redis = require('../../../lib/redis'),
  debug = require('debug')('user-network');

let twitter_consumer_key = process.env.TWITTER_CONSUMER_KEY,
  twitter_consumer_secret = process.env.TWITTER_CONSUMER_SECRET,
  twitter_bearer_token = process.env.TWITTER_BEARER_TOKEN,
  twitter_scrape_method = process.env.TWITTER_SCRAPE_METHOD || "follow_along",//follow_along or twitter
  max_twitter_count = +process.env.MAX_TWITTER_COUNT || 200,
  twitterClient = undefined;

if(twitter_scrape_method === 'twitter') {
  twitterClient = new TwitterApi({
    consumer_key: twitter_consumer_key,
    consumer_secret: twitter_consumer_secret,
    bearer_token: twitter_bearer_token
  });
}

module.exports = {

  getClusters(clusters) {
    const PostsCluster = app.models.PostsCluster;
    return PostsCluster.find({
      where: {
        id: {inq: clusters}
      },
      fields: ['similar_post_ids']
    });
  },

  getEvent(eventId) {
    const Event = app.models.Event;
    return Event.findById(eventId, {
      fields: ['cluster_ids']
    });
  },

  getPostIds(clusters) {
    return _(clusters).map('similar_post_ids')
      .flatten().compact().uniq().value();
  },

  getPosts(postIds) {
    const SocialMediaPost = app.models.SocialMediaPost;

    return SocialMediaPost.find({
      where: {
        post_id: {inq: postIds}
      },
      fields: ['author_id','screen_name']
    });
  },

  getEventNetwork(eventId) {
    const EventNetwork = app.models.EventNetwork;

    return EventNetwork.findOrCreate(
      { where: { event_id: eventId } },
      { event_id: eventId }
    )
    .then(networks => networks[0]) // findOrCreate() returns array
  },

  getAuthorIds(posts, eventId) {
    let authorKey = twitter_scrape_method === 'twitter'?'author_id':'screen_name';
    let authorIds = _(posts).map(authorKey)
      .flatten().compact().uniq().value();
    debug(authorIds);
    return {authorIds, eventId};
  },

  getHash(str){
    let hash = 0, i, chr;
    if (str.length === 0) return hash;
    for (i = 0; i < str.length; i++) {
      chr   = str.charCodeAt(i);
      hash  = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  },

  getRelationships(authorId, authorRelations) {
    let me = this;
    let relatedTo = [];

    let follows = authorRelations['follows'][authorId];
    let followers = authorRelations['followers'][authorId];

    authorRelations.authorIds.forEach(function(otherId){
      if(authorId == otherId) return;
      if(_.includes(follows,otherId)){relatedTo.push(otherId);}
      if(_.includes(followers,otherId)){relatedTo.push(otherId);}
    });

    if(relatedTo.length == 0) return;

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

  getRelationshipData(authorRelations, network) {
    let me = this;
    return new Promise((resolve)=> {
      debug("getting relationship data");
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

      debug("saving network");
      network.event_id = authorRelations.eventId;
      network.status = 1;
      network.data = authorRelations.network;
      network.save(function(err,obj){
        if(err){
          console.error(err);
          network = obj;
        }
      });
      debug("network saved");
      resolve(authorRelations);
    });
  },

  getDataForAuthorPromise(endpoint, user_id, key, authorRelations) {
    return new Promise((resolve)=> {
      let params = {user_id: user_id, count: max_twitter_count};
      twitterClient.get(endpoint, params, function (error, cursor) {
        if (error || !cursor) {
          resolve(authorRelations);
          return;
        }
        authorRelations[key][user_id] = cursor.ids.map(String);
        resolve(authorRelations);
      });
    });
  },

  getDataForAuthorRedisPromise(endpoint, user_id, key, authorRelations) {
    return new Promise((resolve, reject) => {
      let params = {id: user_id, state:'new', max: max_twitter_count};
      redis.hmset(user_id, params)
      .then(() => {
        redis.lpush('genie:followfinder', user_id)
        .then(() => {
          let interval = setInterval(() => {
            redis.hgetall(user_id)
            .then(job => {
              if(_.isEmpty(job)) {
                clearInterval(interval);
                redis.del(user_id);
                return;
              }
              if(job.state === 'new') return;
              clearInterval(interval);
              if(job.state === 'error') {
                redis.del(user_id);
                reject(new Error(job.error));
                return;
              };
              authorRelations[key][user_id] = job.data.split(',');
              redis.del(user_id);
              resolve(authorRelations);
            })
            .catch(reject);
          }, 100);
        })
        .catch(reject);;
      })
      .catch(reject);
    });
  },

  getDataForAuthors(endpoints, authorRelations, network) {
    //authorRelations.authorIds = authorRelations.authorIds.slice(0,60);

    for(let endpoint of endpoints){
      authorRelations[endpoint.key] = {};
    }

    return new Promise((resolve, reject) => {
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
        } else {
          promiseChain = promiseChain
            .then(() => ptools.delay(0))
        }
      }
      promiseChain
        .then(() => resolve(authorRelations))
        .catch(reject);
    });
  },

  execute(options, done) {
    debug(options)
    const eventId = options.qs.eventid;
    if (twitter_scrape_method === 'twitter' && !twitterClient) {
      return done(new Error('twitter client not ready'));
    }

    let network; // for later in the chain
    this.getEventNetwork(eventId)
      .then(n => {
        // if running/complete, exit.
        if (n.status) throw new Error(`${n.id} status ${n.status}`);
        network = n
      })
      .then(() => this.getEvent(eventId))
      .then(event => this.getClusters(event.cluster_ids))
      .then(clusters => this.getPostIds(clusters))
      .then(postIds => this.getPosts(postIds))
      .then(posts => this.getAuthorIds(posts, eventId))
      .then(authorRelations => this.getDataForAuthors([
          { endpoint:'friends/ids', key:'follows' },
          { endpoint:'followers/ids', key:'followers' }
        ], authorRelations, network))
      .then(() => done())
      .catch(done);
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
