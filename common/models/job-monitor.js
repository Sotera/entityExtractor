'use strict';

const FeaturizeMonitor = require('../../lib/job-monitors/featurize-monitor'),
  ClusterizeMonitor = require('../../lib/job-monitors/clusterize-monitor'),
  _ = require('lodash')
;

module.exports = function(JobMonitor) {

  JobMonitor.observe('before save', reset);
  JobMonitor.observe('after save', startMonitoring);

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

  function startMonitoring(context, next) {
    const app = context.Model.app,
      jobMonitor = context.instance;

    if (jobMonitor.state !== 'new' || !jobMonitor.start)
      return next();

    // update related posts
    if (!context.isNewInstance) {
      updatePosts(jobMonitor, app)
      .then(() => removeClusters(jobMonitor))
      .then(() => monitor(jobMonitor, app))
      .then(() => next())
      .catch(err => console.error(err.stack));
    } else {
      monitor(jobMonitor, app);
      next();
    }
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

  function monitor(jobMonitor, app) {
    const fMonitor = new FeaturizeMonitor(jobMonitor, app);

    fMonitor.start();

    fMonitor.on('featurized', onFeaturized);

    function onFeaturized() {
      jobMonitor.updateAttributes({state: 'featurized'})
      .then(jobMonitor => {
        const cMonitor = new ClusterizeMonitor(jobMonitor, app);
        cMonitor.on('done', onDone);
        cMonitor.start();
      })
      .catch(err => console.error(err.stack));
    }

    function onDone() {
      // TODO: 'done' when there were errors or warnings?
      jobMonitor.updateAttributes({
        state: 'done',
        done_at: new Date(),
        error_msg: fMonitor.errors.join(',')
      })
      .catch(err => console.error(err.stack));
    }
  }
};
