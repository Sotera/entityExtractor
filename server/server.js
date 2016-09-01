'use strict';

require('dotenv').config({silent: false});

var loopback = require('loopback');
var boot = require('loopback-boot');
var bodyParser = require('body-parser');
var app = module.exports = loopback();
var kue = require('kue');
var path = require('path');

// protect qcr endpoint with basic auth
require('./basic-auth').auth(app, ['qcr/insert']);

// to support JSON-encoded bodies
app.middleware('parse', bodyParser.json());
// to support URL-encoded bodies
app.middleware('parse', bodyParser.urlencoded({
  extended: true
}));

app.start = function() {
  // mount kue jobs UI
  app.use('/kue', kue.app);
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
    // if WORKER_SCRIPT present, start it instead of api.
    var scriptPath = process.env.WORKER_SCRIPT,
      worker;
    if (scriptPath) {
      scriptPath = path.join(__dirname, scriptPath);
      console.log('Attempting to start worker at %s...', scriptPath);
      try {
        worker = require(scriptPath);
      } catch(e) {
        console.error('script path \'%s\' invalid? \
Must be relative to %s', scriptPath, __dirname);
        console.error(e);
      }
      worker.start();
      console.log('%s started', scriptPath);
      return;
    } else {
      app.start();
    }
  }
});
