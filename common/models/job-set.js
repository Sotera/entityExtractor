'use strict';

const getSettings = require('../../server/util/get-settings');

module.exports = function(JobSet) {

  JobSet.observe('after save', startJobMonitors);

  // create child jobmonitors from settings
  function startJobMonitors(context, next) {
    if (!context.isNewInstance) { // only existing
      const jobSet = context.instance;

      if (jobSet.state === 'running') {
        jobSet.jobMonitors({}, (err, monitors) => {
          if (err)
            return console.error(err);

          // create only if no existing
          if (!monitors.length)
            createJobMonitors(jobSet);
        });
      }
    }

    // fire and forget
    next();
  }
};

function createJobMonitors(jobSet) {
  getSettings(['job_monitors'], (err, settings) => {
    if (err)
      return console.error(err);

    settings.job_monitors.forEach(obj => {
      jobSet.jobMonitors.create({
        start_time: jobSet.start_time,
        end_time: jobSet.end_time,
        featurizer: obj.featurizer,
        lang: obj.lang,
        service_args: obj.service_args
      })
      .catch(console.error);
    });
  });
}
