'use strict';

require('dotenv').config({silent: true});

let loopback = require('loopback'),
  boot = require('loopback-boot'),
  app = module.exports = loopback(),
  path = require('path');

app.start = function() {
  // start the web server
  return app.listen(function() {
    app.emit('started');
    let baseUrl = app.get('url').replace(/\/$/, '');
    console.log('Web server listening at: %s', baseUrl);
    if (app.get('loopback-component-explorer')) {
      let explorerPath = app.get('loopback-component-explorer').mountPath;
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
    // 'worker' can be anything: websocket server, another http server, etc.
    let scriptPath = process.env.WORKER_SCRIPT;

    if (scriptPath) {
      return startWorker(scriptPath, app);
    } else {
      app.start();
    }
  }
});

function startWorker(scriptPath, app) {
  let worker;

  scriptPath = path.join(__dirname, scriptPath);
  console.log('Attempting to start worker|server at %s...', scriptPath);
  try {
    worker = require(scriptPath);
  } catch(e) {
    console.error('script path \'%s\' invalid? \
Must be relative to %s', scriptPath, __dirname);
    console.error(e);
  }
  worker.start(app);
  console.log('%s started', scriptPath);
  return;
}
