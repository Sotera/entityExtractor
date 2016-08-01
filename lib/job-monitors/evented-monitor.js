'use strict';

const EventEmitter = require('events').EventEmitter,
  app = require('../../server/server'),
  Tweet = app.models.Tweet,
  util = require('util'),
  EventedSet = require('./evented-set'),
  redis = require('../redis'),
  _ = require('lodash'),
  WATCH_INTERVAL = 5 // secs;

// def: a job submitter and monitor for a given time period and featurizer type
class EventedMonitor extends EventEmitter {
  constructor(args) {
    super();
    this.id = (args.id || Date.now()).toString();
    this.start_time = args.start_time;
    this.end_time = args.end_time;
    this.featurizer = args.featurizer;
    this.state = args.state || 'new';
    this.set = new EventedSet();
    this.doc = args.doc; // database object
    //TODO: where from?
    this.channel_name = args.channel_name || 'features';
  }

  start() {
    if (this.state === 'done') return;
    if (this.state === 'new') {
      console.info('monitor %s started watching', this.id);
      this.watch()
      this.set.on('emptied', this.reset.bind(this));
    };

    this.submitTweets();
  }

  getQueryFilter(state) {
    state = state || this.state;
    return {
      state: state,
      timestamp_ms: {
        between: [this.start_time, this.end_time]
      },
      featurizers: this.featurizer
    };
  }

  submitTweets() {
    const PER_PAGE = 50,
      context = this;
    let _count = 0;

    Tweet.count(this.getQueryFilter())
    .then(page)
    .catch(err => console.error(err, err.stack));;

    function page(count) {
      if (_count >= count) return;

      return Tweet
      .find({
        where: context.getQueryFilter(),
        order: 'id asc',
        skip: _count, limit: PER_PAGE
      })
      .then(tweets => {
        _count += tweets.length;
        tweets.forEach(tweet => {
          context.submit(tweet)
        });
      })
      .then(() => page(count));
    }
  }

  reset() {
    let prevState = this.state;
    this.state = this.getNextState(prevState);

    console.info('monitor %s changed from %s to %s',
      this.id.toString(), prevState, this.state);

    Tweet
    .updateAll(this.getQueryFilter(prevState), { state: this.state })
    .then(() => {
      if (this.state === 'done') this.emit('done');
    })
    .then(() => this.start())
    .catch(err => console.error(err, err.stack));
  }

  getNextState(prevState) {
    switch (prevState || this.state) {
      case 'new':
        return 'featurized';
        break;
      case 'featurized':
        return 'clustered';
        break;
      case 'clustered':
        return 'done';
        break;
      default:
        throw new Error('unknown monitor state for %s', this.id.toString());
    }
  }

  submit(tweet) {
    const key = tweet.id_str,
      jobAttrs = { state: this.state };

    return redis
    .hmset(key, jobAttrs)  //TODO: tweet attrs?
    .then(() => redis.publish(this.channel_name, key))
    .then(() => this.set.add(key))
    .then(() => console.info('%s submitted', key))
    .catch(err => console.error(key, err, err.stack));
  }

  watch() {
    checkJobs(this.set)
    .then(() => delay(WATCH_INTERVAL))
    .then(this.watch.bind(this))
    .catch(err => console.error(err, err.stack));
  }
}

function delay(interval) {
  return new Promise((res, rej) => {
    setTimeout(res, interval * 1000);
  });
};

function checkJobs(jobs) {
  //TODO: lots of redis connections?
  return Promise.all(
    //TODO: rm Array.from
    Array.from(jobs.values()).map(key => {
      return redis.hgetall(key)
      .then(data => {
        if (!data) {
          console.log('%s not found', key);
          jobs.delete(key);
        } else if (data.state === 'processed') {
          if (_.isEmpty(data.data)) {
            console.error('%s is missing data', key);
          } else {
            console.log('%s processed', key);
            // TODO
            // let clusters = JSON.parse(data.data);
            // saveClusters(key, clusters);
          }
          jobs.delete(key);
          redis.del(key); //good citizen cleanup
        } else if (data.state === 'error') {
          console.error('%s reported an error: %s', key, data.error);
          jobs.delete(key);
          redis.del(key); //good citizen cleanup
        } else {
          console.log('not finished: %s state: %s', key, data.state);
        }
      })
      .catch(err => {
        console.error('polling err for %s', key, err, err.stack);
        jobs.delete(key);
      });
    })
  );
}

module.exports = EventedMonitor;

// start if run as a worker process
if (require.main === module) {
  const monit = new EventedMonitor({
    start_time: 0,
    end_time: 0,
    featurizer: 'image'
  });
  monit.start();
}
