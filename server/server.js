'use strict';

require('dotenv').config({silent: true});

var loopback = require('loopback');
var boot = require('loopback-boot');
var bodyParser = require('body-parser');
var app = module.exports = loopback();

// protect qcr endpoint with basic auth
require('./basic-auth').auth(app, ['qcr/insert']);

// to support JSON-encoded bodies
app.middleware('parse', bodyParser.json());
// to support URL-encoded bodies
app.middleware('parse', bodyParser.urlencoded({
  extended: true
}));

app.start = function() {
  // start the web server
  return app.listen(function() {
    app.emit('started');
    var baseUrl = app.get('url').replace(/\/$/, '');
    console.log('Web server listening at: %s', baseUrl);
    if (app.get('loopback-component-explorer')) {
      var explorerPath = app.get('loopback-component-explorer').mountPath;
      console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
    }
  });
};

// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, function(err) {
  if (err) throw err;

  // start the server if `$ node server.js`
  if (require.main === module) {
    var worker = process.env.WORKER_SCRIPT;
    if (worker) {
      console.log('Attempting to start a worker process...');
      try {
        worker = require(worker);
      } catch(e) {
        console.error('script path \'%s\' is invalid. Must be relative to %s', worker, __dirname);
      }
      worker.start();
      return;
    } else {
      app.start();
    }
  }
});
