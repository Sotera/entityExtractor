'use strict';

const entityExtractor = require('../../../../lib/entity-extractor'),
  app = require('../../../../server/server'),
  delay = require('../../../util/promise-tools').delay
;

// def: detect threats.

module.exports = {
  detect(msg) {
    let jobId = entityExtractor.detectThreats(msg.archive_url, msg.time_of_day);

    return run();
    function run() {
      return checkJob(jobId).then(inspectJob);
    }

    function inspectJob(job) {
      if (job.state === 'processed') {
        return job;
      } else if (job.state === 'error') {
        console.error(job.error);
        return job;
      } else {
        // console.log('checking...')
        return delay(1).then(run);
      }
    }
  }
};

function checkJob(id) {
  return app.models.Job.get(id);
}
