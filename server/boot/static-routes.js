'use strict';

const loopback = require('loopback'),
  getSettings = require('../util/get-settings'),
  _ = require('lodash');

// def: static routes, likely for internally hosted assets for a service
module.exports = function(app) {

  getSettings(['static_routes'], (err, settings) => {
    if (err) return console.error(err);
    if (_.isEmpty(settings)) return;

    // expects object: {threats: {mount: '/threats', path: '/downloads/threats'}}
    _.forOwn(settings.static_routes, (route, key) => {
      app.use(route.mount, loopback.static(route.path));
    });
  });

};
