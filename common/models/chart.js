'use strict';

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

  Chart.chart = function(src, type, filter, cb){
    let routeKey = `../../server/chart/${src}/${type}`,
      route = routes[routeKey];
    if (!route) {
      try {
        route = require(routeKey);
      } catch(err) {
        return cb({error: 'route does not exist'});
      }
      routes[routeKey] = route;
    }
    route.execute(filter, cb);
  };
};
