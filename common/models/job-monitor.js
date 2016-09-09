'use strict';

const FeaturizeMonitor = require('../../lib/job-monitors/featurize-monitor'),
  ClusterizeMonitor = require('../../lib/job-monitors/clusterize-monitor'),
  _ = require('lodash'),
  jobs = require('../../lib/jobs')
;

module.exports = function(JobMonitor) {

  JobMonitor.observe('before save', reset);
  JobMonitor.observe('after save', startMonitor);

  // reset for monitor re-runs
  function reset(context, next) {
    if (!context.isNewInstance) { // only existing monitors
      const jobMonitor = context.currentInstance,
        updates = context.data; // values that will be updated
      if (updates.state === 'new' && jobMonitor.start) {
        // reset previous error
        updates.error_msg = null;
        updates.done_at = null;
      }
    }

    next();
  }

  function startMonitor(context, next) {
    const app = context.Model.app,
      jobMonitor = context.instance;

    if (jobMonitor.state !== 'new' || !jobMonitor.start)
      return next();

    // update related posts
    if (!context.isNewInstance) {
      updatePosts(jobMonitor, app)
      .then(() => removeClusters(jobMonitor))
      .then(() => createJob(jobMonitor))
      .then(() => next())
      .catch(err => console.error(err.stack));
    } else {
      createJob(jobMonitor);
      next();
    }
  }

  function createJob(jobMonitor) {
    jobs.create('job monitor', {
      jobMonitorId: jobMonitor.id
    });
  }

  function removeClusters(jobMonitor) {
    return jobMonitor.postsClusters.destroyAll();
  }

  function updatePosts(jobMonitor, app) {
    let query = {
      featurizer: jobMonitor.featurizer,
      state: {neq: 'new'},
      timestamp_ms: {
        between: [
          jobMonitor.start_time,
          jobMonitor.end_time
        ]
      }
    };

    if (!_.isEmpty(jobMonitor.lang)) {
      query.lang = jobMonitor.lang
    }

    return app.models.SocialMediaPost.updateAll(query, {state: 'new', image_features: [], text_features: []});
  }

  JobMonitor.destroyData = function(cb) {
    JobMonitor.destroyAll()
     .then(() => cb(null, {data: 'All data destroyed'}))
     .catch(cb);
   };

  JobMonitor.remoteMethod(
     'destroyData',
     {
       accepts: [
       ],
       returns: {arg: 'data', root: true},
       http: {path: '/destroy', verb: 'get'}
     }
   );
};
