'use strict';

const jobs = require('../../lib/jobs');

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
          arg: 'filter',
          type: 'object',
          http: ctx => ctx.req.query
        }
      ],
      returns: { type: 'object', root: true }
    }
  );

  Chart.chart = function(src, type, filter, cb) {
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

    jobs.create('chart data', {
      eventId: filter.eventid,
      src,
      type,
      ttl: 120
    });

    cb(null, {ok: 1})
  };

  Chart.remoteMethod(
    'locationsearch',
    {
      description: 'Fetch data for various charts',
      accepts: {
        arg: 'args',
        type: 'object',
        description: 'object with property "term"',
        required: true,
        http: { source: 'body' }
      },
      http: {path: '/locationsearch', verb: 'post'},
      returns: { type: 'object',root:true }
    }
  );

  Chart.locationsearch = function(args, cb) {
    let routeKey = `../../server/chart/twitter/location-search`,
      route = routes[routeKey];
    if (!route) {
      try {
        route = require(routeKey);
      } catch(err) {
        cb(err);
        return;
      }
      routes[routeKey] = route;
    }

    routes[routeKey].execute(args.term,cb);
  };
};
