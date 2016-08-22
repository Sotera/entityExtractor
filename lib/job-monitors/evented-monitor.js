'use strict';

const EventEmitter = require('events').EventEmitter,
  ptools = require('../promise-tools'),
  EventedSet = require('./evented-set'),
  JobInspector = require('./job-inspector'),
  idGen = require('../id-generator'),
  redis = require('../redis'),
  util = require('util'),
  _ = require('lodash'),
  WATCH_INTERVAL = 5 // secs;

// def: a job submitter and monitor for a given time period and featurizer type.
//    wraps a jobMonitor instance to provide event-based actions and state mgmt.
class EventedMonitor extends EventEmitter {
  // accept app object so we don't have to create
  // one on every monitor instance.
  constructor(jobMonitor, app) {
    super();
    this.jobMonitor = jobMonitor; // database object
    this.app = app;
    this.id = jobMonitor.id.toString();
    this.start_time = jobMonitor.start_time;
    this.end_time = jobMonitor.end_time;
    this.featurizer = jobMonitor.featurizer;
    this.lang = jobMonitor.lang;
    this.state = jobMonitor.state; // mutable state
    this.initialState = null; // set by subclass
    this.finalState = null; // set by subclass
    this.queue = new EventedSet();
    this.jobPrefix = 'genie:';
    this.stopWatching = false;
  }

  start() {
    // in initial state so start
    if (this.state === this.initialState) {
      // monitors expect to find posts but just in case
      this.getPostsCount()
      .then(count => {
        if (count > 0) {
          console.info('monitor %s started monitoring', this.id);
          // these run for lifetime of the monitor.
          // submit all before starting the watcher.
          this.submitJobs()
          .then(this.watchJobs.bind(this))
          .catch(err => console.error(err.stack));

          this.queue.on('emptied', this.reset.bind(this));
        } else {
          console.info('monitor %s found 0 posts. not starting.', this.id);
          this.emit(this.finalState); // alert for next monitor
          return;
        }
      })
      .catch(err => console.error(err.stack));
    // in final state so stopping
    } else if (this.state === this.finalState) {
      console.info('monitor %s state is %s so stopping', this.id, this.state);
      this.stopWatching = true;
      return;
    // in unexpected (or further down-the-line) state
    } else {
      console.info('monitor %s state is %s. nothing to do.', this.id, this.state);
      return;
    }
  }

  getPostsCount() {
    return this.app.models.SocialMediaPost.count(this.getQueryFilter());
  }

  getQueryFilter(state) {
    state = state || this.state;
    return {
      state: state,
      timestamp_ms: {
        between: [this.start_time, this.end_time]
      },
      featurizer: this.featurizer
    };
  }

  reset() {
    let prevState = this.state;
    this.state = this.getNextState(prevState);

    console.info('monitor %s changed from %s to %s',
      this.id, prevState, this.state);

    this.app.models.SocialMediaPost
    .updateAll(this.getQueryFilter(prevState), { state: this.state })
    .then(() => {
      this.emit(this.state);
      this.start();
    })
    .catch(err => console.error(err.stack));
  }

  getNextState(prevState) {
    switch (prevState || this.state) {
      case 'new':
        return 'featurized';
        break;
      case 'featurized':
        return 'done';
        break;
      default:
        throw new Error(
          util.format('unknown monitor state %s for %s',
          this.state, this.id)
        );
    }
  }

  // useful if monitor doesn't have a natural job key, like post_id
  generateJobKey() {
    let key;
    // N.B. not universally unique if queue is in-memory.
    // assumes rare mishaps are ok.
    do {
      key = this.keyPrefix + idGen.randomish(0, 9999999999)
    } while (this.queue.has(key));

    return key;
  }

  watchJobs() {
    if (this.stopWatching) return;
    this.checkAllJobs()
    .then(() => ptools.delay(WATCH_INTERVAL))
    .then(this.watchJobs.bind(this))
    .catch(err => console.error(err.stack));
  }

  checkAllJobs() {
    console.info('checking %d jobs...', this.queue.set.size);
    return Promise.all(
      //TODO: rm Array.from
      Array.from(this.queue.values()).map(key => {
        let inspector = new JobInspector({
          key,
          queue: this.queue,
          onComplete: this.onJobComplete.bind(this),
          onError: this.onJobError.bind(this)
        });
        return inspector.run();
      })
    );
  }

  onJobError(msg) {
    this.jobMonitor
    .updateAttributes({error_msg: msg, done_at: new Date()})
    .catch(err => console.error(err.stack));
  }

  onJobComplete() {
    // for subclasses
  }
}

module.exports = EventedMonitor;
