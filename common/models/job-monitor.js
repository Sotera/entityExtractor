'use strict';

const FeaturizeMonitor = require('../../lib/job-monitors/featurize-monitor'),
  ClusterizeMonitor = require('../../lib/job-monitors/clusterize-monitor')
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
    if (!context.isNewInstance)
      updatePosts(jobMonitor, app)
      .then(() => monitor(jobMonitor, app))
      .catch(err => console.error(err.stack));
    else
      monitor(jobMonitor, app);

    next();
  }

  function updatePosts(jobMonitor, app) {
    return app.models.SocialMediaPost.updateAll({
      lang: jobMonitor.lang,
      featurizers: jobMonitor.featurizer,
      state: {neq: 'new'},
      timestamp_ms: {
        between: [
          jobMonitor.start_time.toString(),
          jobMonitor.end_time.toString()
        ]
      }
    }, {state: 'new'});
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
      jobMonitor.updateAttributes({
        state: 'done', done_at: new Date()
      })
      .catch(err => console.error(err.stack));
    }
  }
};
