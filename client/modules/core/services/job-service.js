'use strict';

angular.module('com.module.core')
.factory('JobService', function(Job) {

  // interval in sec.
  function delay(interval=1) {
    return new Promise((res, rej) => {
      setTimeout(res, interval * 1000);
    });
  }

  function getStatus(jobId) {
    return Job.status({
      job_id: jobId
    })
    .$promise
    .then(job => {
      console.info(job)
      return job;
    });
  }

  function poll(jobId) {
    return delay()
    .then(() => getStatus(jobId))
    .then(job => job.state !== 'processed')
    .then(complete => complete && poll(jobId));
  }

  return {
    getStatus,
    poll
  };
});
