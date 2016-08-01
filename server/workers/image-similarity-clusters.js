// def: trigger clustering jobs and get results from redis

'use strict';

require('dotenv').config({silent: true});

const app = require('../server'),
  ClusterJob = app.models.ClusterJob,
  moment = require('moment'),
  redis = require('../../lib/redis'),
  _ = require('lodash'),
  channelName = 'similarity',
  QUERY_SPAN_MINS = 15,
  POLL_WAIT = 10, // seconds
  esHost = (process.env.ES_HOST || 'elasticsearch:9200').split(':'),
  esIndex = process.env.ES_INDEX.split('/'),
  seedTime = process.env.SEED_TIME || 1451606400, //2016-01-01
  CLUSTER_PARAMS_TEMPLATE = {
    state: 'new',
    similarity_threshold: 0.5,
    es_host: esHost[0],
    es_port: esHost[1] || 9200,
    es_index: esIndex[0],
    es_doc_type: esIndex[1],
    es_query:{
      fields:['timestamp_ms','features','id'],
      query:{
        bool:{
          must:{
            term:{features:0}
          },
          filter:{
            range:{
              timestamp_ms:{
                gte:null, // replaced when used
                lt:null
              }
            }
          }
        }
      }
    }
  }
;


let queue = new Set(); // jobs in-process

const worker = module.exports = {
  start() {
    run();

    // kickoff secondary process to save clusters
    setInterval(pollClusterer, POLL_WAIT * 1000);
  }
};

// start if run as a worker process
if (require.main === module)
  worker.start();

function run() {
  prep()
  .then(() => getLastJob())
  .then(inspectLastJob)
  .then(startNewJob)
  .catch(console.error)
  .then(() => delay())
}

function delay() {
  setTimeout(run, POLL_WAIT * 1000);  // not so fast my friend
  console.log('Pausing clusterer for %d sec ...', POLL_WAIT);
}

function prep() {
  return Promise.resolve();
}

function getLastJob() {
  return ClusterJob.findOne({order: 'end_time desc'});
}

function inspectLastJob(lastJob) {
  const lastQueryTime = (lastJob ? lastJob.end_time : seedTime);
  const now = moment()
    .subtract(QUERY_SPAN_MINS * 60, 'seconds').unix();
  if (lastQueryTime < now) {
    return lastQueryTime;
  } else {
    return;
  }
}

function startNewJob(startTime) {
  if (!startTime) return;
  const queryStart = startTime,
    queryEnd = queryStart + QUERY_SPAN_MINS * 60,
    params = getClustererParams({
      startTime: queryStart,
      endTime: queryEnd
    });

  return ClusterJob.create({
    start_time: queryStart,
    end_time: queryEnd,
    params
  })
  .then(triggerClusterer)
  .then(addToQueue);
}

function getClustererParams(args) {
  let params = _.cloneDeep(CLUSTER_PARAMS_TEMPLATE);
  params.es_query.query.bool.filter.range
    .timestamp_ms = {
      gte: args.startTime,
      lt: args.endTime
    };
  // node-redis (and redis) don't support nested objects
  params.es_query = JSON.stringify(params.es_query);
  return params;
}

function triggerClusterer(newJob) {
  const key = newJob.id.toString();

  console.log('submitted job', key);

  return Promise.all([
    redis.hmset(key, newJob.params),
    redis.publish(channelName, key)
  ])
  .then(() => key); // return key for later polling
}

function addToQueue(key) {
  queue.add(key);
}


function pollClusterer() {
  console.log('polling for clusterer results');
  queue.forEach(key => {
    redis.hgetall(key)
    .then(data => {
      if (!data) {
        console.log('%s not found', key);
        queue.delete(key);
      } else if (data.state === 'processed') {
        if (_.isEmpty(data.data)) {
          console.error('%s is missing clusters data', key);
        } else {
          let clusters = JSON.parse(data.data);
          saveClusters(key, clusters);
        }
        queue.delete(key);
        redis.del(key); //good citizen cleanup
      } else if (data.state === 'error') {
        console.error('%s reported an error: %s', key, data.error);
        queue.delete(key);
        redis.del(key); //good citizen cleanup
      } else {
        console.log('not finished: %s state: %s', key, data.state);
      }
    })
    .catch(err => {
      console.error('polling err for item %s', key, err);
      queue.delete(key);
    });
  });
}

function saveClusters(key, clusters) {
  ClusterJob.findById(key)
  .then(job => {
    return job.updateAttributes({
      clusters,
      state: 'done'
    });
  })
  .then(() => console.log('clusters saved for %s', key))
  .catch(console.error);
}
