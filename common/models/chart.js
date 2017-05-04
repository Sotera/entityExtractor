'use strict';

const jobs = require('../../lib/jobs'),
  idGen = require('../../server/util/id-generator');

module.exports = function(Chart) {

  let routes = {};

  Chart.remoteMethod(
    'chart',
    {
      description: 'Fetch data for various charts',
      http: { path: '/:src/:type', verb: 'get' },
      accepts: [
        {
          arg: 'src',
          type: 'string',
          description: 'chart source'
        },
        {
          arg: 'type',
          type: 'string',
          description: 'chart type'
        },
        {
          arg: 'qs',
          description: 'querystring',
          type: 'object',
          http: ctx => ctx.req.query
        }
      ],
      returns: { type: 'object', root: true }
    }
  );

  Chart.chart = function(src, type, qs, cb) {
    // check module exists
    let routeKey = `../../server/chart/${src}/${type}`,
      route = routes[routeKey];
    if (!route) {
      try {
        route = require(routeKey);
      } catch(err) {
        return cb(err);
      }
      routes[routeKey] = route;
    }

    // for client to poll /jobs for job completion.
    const jobId = idGen.randomish(0, 9999999999).toString();

    // send to kue.
    jobs.create('chart data', {
      qs,
      src,
      type,
      ttl: 60,
      jobId
    });

    cb(null, { job_id: jobId })
  };
}
