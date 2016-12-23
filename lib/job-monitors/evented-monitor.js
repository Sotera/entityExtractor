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
    this.errors = [];
    this.monitoredModel = this.app.models.SocialMediaPost;
  }

  start() {
    // in initial state so start
    if (this.state === this.initialState) {
      // monitors expect to find posts but just in case
      this.getItemsCount()
      .then(count => {
        if (count > 0) {
          console.info('%s %s started', this.constructor.name, this.id);
          // these run for lifetime of the monitor.
          // submit all before starting the watcher.
          this.submitJobs()
          .then(() => {
            // check if any jobs created
            if (this.queue.size > 0) {
              this.queue.on('emptied', this.reset.bind(this));
              return true;
            } else {
              // stop here and don't start watcher
              console.info('%s %s submitted 0 jobs, so stopping.',
                this.constructor.name, this.id);
              this.reset();
              return false;
            }
          })
          .then(watch => watch ? this.watchJobs.bind(this)() : null)
          .catch(err => console.error(err.stack));
        } else {
          console.info('%s %s found 0 posts. not starting.',
            this.constructor.name, this.id);
          this.emit(this.finalState); // alert for next monitor
          return;
        }
      })
      .catch(err => console.error(err.stack));
    // in final state so stopping
    } else if (this.state === this.finalState) {
      console.info('%s %s state is %s so stopping',
        this.constructor.name, this.id, this.state);
      this.stopWatching = true;
      return;
    // in unexpected (or further down-the-line) state
    } else {
      console.info('%s %s state is %s. nothing to do.',
        this.constructor.name, this.id, this.state);
      return;
    }
  }

  findFirst() {
    return this.monitoredModel.findOne({
      where: this.getQueryFilter(),
      order: '_id asc'
    });
  }

  getItemsCount() {
    return this.monitoredModel.count(this.getQueryFilter());
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

  // submit jobs while scrolling thru queries (skip/offset is sloooow in mongo)
  scrollSubmit() {
    const PER_PAGE = 50,
      context = this;
    let lastItemId; // marker for scrolling

    return this.getItemsCount()
    .then(count => {
      console.info('inspecting %d items', count);
      return context.findFirst()
      .then(item => item && item.id);
    })
    .then(scroll)
    .catch(err => console.error(err.stack));

    function scroll(itemId) {
      if (!itemId) return; // once we've run out of items

      const op = lastItemId ? 'gt' : 'gte'; // inclusive on first run

      return context.monitoredModel.find({
        where: _.assign(context.getQueryFilter(), { id: { [op]: itemId } }),
        order: '_id asc',
        limit: PER_PAGE
      })
      .then(items => {
        if (items.length) {
          lastItemId = items[items.length-1].id;
          return Promise.all(
            items.map(context._submit, context)
          )
          .then(() => lastItemId);
        } else {
          return;
        }
      })
      .then(scroll);
    }
  }

  reset() {
    let prevState = this.state;
    this.state = this.getNextState(prevState);

    console.info('%s %s changed from %s to %s',
      this.constructor.name, this.id, prevState, this.state);

    this.monitoredModel
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
        return 'preprocessed';
        break;
      case 'preprocessed':
        return 'featurized';
        break;
      case 'featurized':
        return 'clustered';
        break;
      case 'clustered':
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
    console.info('%s %s checking %d jobs...',
      this.constructor.name, this.id, this.queue.size);
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

  onJobError(key, msg) {
    let errMsg = util.format('[key %s] %s', key, msg);
    console.error(errMsg);
    // often the same error repeatedly so don't save all
    if (this.errors.length < 10)
      this.errors.push(errMsg);
  }

  onJobComplete() {
    // for subclasses
  }
}

module.exports = EventedMonitor;
