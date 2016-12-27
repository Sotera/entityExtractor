'use strict';

// update db schema from model defs
module.exports = function(app) {
  app.dataSources.db.autoupdate(function(err, result) {});
};
