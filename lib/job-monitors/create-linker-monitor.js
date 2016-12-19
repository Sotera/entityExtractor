'use strict';

require('dotenv').config({silent: true});

const _ = require('lodash');

// def: check all job monitor changes and start a linker job when
// all related job monitors are done.
module.exports = {
  start(app) {
    const JobMonitor = app.models.JobMonitor;

    JobMonitor.createChangeStream((err, changes) => {
      if (err) return console.error('change stream err:', err);

      changes.on('data', target => {
        // console.info('JobMonitor changes:', target);
        const jobMonitor = target.data;

        if (target.type === 'update' && jobMonitor.state === 'done' &&
          jobMonitor.featurizer !== 'linker') {
          createLinkerMonitor(jobMonitor);
        }
      });
    });
  }
};

function createLinkerMonitor(jobMonitor) {
  jobMonitor.jobSet((err, jobSet) => {
    if (err)
      return console.error(err);

    jobSet.jobMonitors({}, (err, monitors) => {
      if (err)
        return console.error(err);

      // all monitors done so start linker
      if (_.every(monitors, m => m.state === 'done')) {
        jobSet.jobMonitors.create({
          start_time: jobMonitor.start_time,
          end_time: jobMonitor.end_time,
          featurizer: 'linker'
        })
        .catch(console.error);
      }
    });
  });
}
