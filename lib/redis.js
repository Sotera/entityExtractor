'use strict';

const redis = require('redis'),
  bluebird = require('bluebird'),
  client = redis.createClient({ host: 'redis' })
;

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

client.on('error', err => {
  console.error('Redis Error:', err);
});

module.exports = {
  hmset(k, obj) {
    return client.hmsetAsync(k, obj);
  },
  del(k) {
    return client.delAsync(k);
  },
  hgetall(k) {
    return client.hgetallAsync(k);
  },
  publish(channel, msg) {
    return client.publishAsync(channel, msg);
  },
  lpush(list, val) {
    return client.lpushAsync(list, val);
  }
};
