'use strict';

module.exports = function(Chart) {

    let routes = {};

    Chart.remoteMethod(
        'chart',
        {
            description: 'Twitter endpoint to receive followers',
            http: { path: '/:src/:type', verb: 'get' },
            accepts: [{
                    arg: 'src',
                    type: 'string',
                    description: 'the chart source'
                },
                {
                    arg: 'type',
                    type: 'string',
                    description: 'the chart type'
                },
                {
                    arg: 'filter',
                    type: 'object', http: function(ctx) {
                        return ctx.req.query
                    }
                }
            ],
            returns: { type: 'object', root: true }
        }
    );

    Chart.chart = function(src, type, filter, cb){
        let routeKey = "../../server/chart/" + src + "/" + type;
        let route = routes[routeKey];
        if(!route){
            try {
                route = require(routeKey);
            }
            catch(err){
                cb({"message": "route does not exist"}, null)
                return;
            }
            routes[routeKey] = route;
        }
        route.execute(filter, cb);
    };


};
