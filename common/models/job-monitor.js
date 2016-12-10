'use strict';

const _ = require('lodash'),
  jobs = require('../../lib/jobs')
;

module.exports = function(JobMonitor) {

  JobMonitor.observe('after save', startMonitor);

  function startMonitor(context, next) {
    const jobMonitor = context.instance;

    if (jobMonitor.state === 'new' && jobMonitor.start) {
      // finish jobsets ASAP. not be necessary since jobsets run sequentially?
      const priority = jobMonitor.featurizer === 'linker' ? 'high' : null;

      jobs.create('job monitor', {
        jobMonitorId: jobMonitor.id,
        priority
      });
    }

    // fire and forget
    next();
  }
};
