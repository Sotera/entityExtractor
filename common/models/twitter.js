'use strict';
const _ = require('lodash'),
      TwitterApi = require('twitter');

module.exports = function(Twitter) {

    let twitter_consumer_key =  process.env.TWITTER_CONSUMER_KEY;
    let twitter_consumer_secret = process.env.TWITTER_CONSUMER_SECRET;
    let twitter_access_token_key = process.env.TWITTER_ACCESS_TOKEN_KEY;
    let twitter_access_token_secret = process.env.TWITTER_ACCESS_TOKEN_SECRET;
    let twitterReady = _.every([twitter_consumer_key , twitter_consumer_secret  ,
        twitter_access_token_key  , twitter_access_token_secret]);
    let twitterClient = undefined;

    if(twitterReady)
        twitterClient = new TwitterApi({
            consumer_key: twitter_consumer_key,
            consumer_secret: twitter_consumer_secret,
            access_token_key: twitter_access_token_key,
            access_token_secret: twitter_access_token_secret
        });



    Twitter.remoteMethod(
        'followers',
        {
            description: 'Twitter endpoint to receive followers',
            http: { path: '/followers/:id', verb: 'get' },
            accepts: {
                arg: 'id',
                type: 'string',
                description: 'user name'
            },
            returns: { type: '[string]', root: true }
        }
    );

    Twitter.followers = function(id,cb){
        if(!twitterReady){
            cb(null,{message:"twitter client not ready"});
            return;
        }
        var params = {screen_name: id};
        twitterClient.get('followers/ids', params, function(error, cursor, response) {
            if (error) {
                cb(null, error);
                return;
            }

            cb(cursor.ids);

        });
    }

};
