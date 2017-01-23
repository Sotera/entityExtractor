'use strict';

// def: redis client wrapper

const redis = require('redis'),
  bluebird = require('bluebird')
;

let client = null
;

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

module.exports = {
  hmset(k, obj) {
    return this.runCmd('hmset', k, obj);
  },
  del(k) {
    return this.runCmd('del', k);
  },
  hgetall(k) {
    return this.runCmd('hgetall', k);
  },
  // publish(channel, msg) {
  //   return this.runCmd('publish', channel, msg);
  // },
  lpush(list, val) {
    return this.runCmd('lpush', list, val);
  },
  runCmd(cmd, ...args) {
    // create client on first use. not as module global.
    if (!client) {
      client = redis.createClient({
        host: process.env.REDIS_HOST || 'redis',
        port: process.env.REDIS_PORT || 6379
      });

      client.on('error', err => {
        console.error('Redis:', err);
      });
    }

    return client[cmd + 'Async'](...args);
  }
};
