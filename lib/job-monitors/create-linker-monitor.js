'use strict';

require('dotenv').config({silent: true});

//TODO: need a better way to know when related monitors are done
const MONITOR_TYPES_COUNT = process.env.MONITOR_TYPES_COUNT;

if (!MONITOR_TYPES_COUNT) {
  throw new Error('Missing required MONITOR_TYPES_COUNT env var');
}

// def: check all JobMonitor changes and try to start a LinkerMonitor when:
  // 1. a monitor is updated to 'done'
  // 2. all its related monitors (non-linker, same timeframe) are also done
module.exports = {
  start(app) {
    const JobMonitor = app.models.JobMonitor;

    JobMonitor.createChangeStream((err, changes) => {
      if (err) return console.error('change stream err:', err);

      changes.on('data', target => {
        // console.info('JobMonitor changes:', target);
        const jobMonitor = target.data;

        if (target.type === 'update' &&
          jobMonitor.state === 'done' &&
          jobMonitor.featurizer !== 'linker') {

          JobMonitor.count({
            start_time: jobMonitor.start_time,
            end_time: jobMonitor.end_time,
            state: 'done',
            featurizer: { neq: 'linker' }
          })
          .then(count => {
            if (count === +MONITOR_TYPES_COUNT) {
              // TODO: re-run if one of the monitors changes.
              // if multiple monitors change?
              // if some monitors set start = false
              return JobMonitor.create({
                start_time: jobMonitor.start_time,
                end_time: jobMonitor.end_time,
                featurizer: 'linker'
              });
            }
          });
        }
      });
    });
  }
};
