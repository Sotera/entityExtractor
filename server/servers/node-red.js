'use strict';

// def: node-red for misc. tasks: scraping, dashboard, etc.
// modified from https://nodered.org/docs/embedding

require('dotenv').config({silent: true});

const RED = require('node-red'),
  VERSION = 'v16', // 0.16 -> create user dir by node-red version
  debug = require('debug')('node-red'),
  express = require('express'),
  http = require('http');


module.exports = { start };

// start if run as a worker process
if (require.main === module)
  start();

function start() {
  // access Express app
  const app = express();

  // Add a simple route for static content served from 'public'
  // app.use('/', express.static('public'));

  // Create a server
  const server = http.createServer(app);

  // Create the settings object - see default settings.js file for other options
  let settings = {
    httpAdminRoot: '/',
    httpNodeRoot: '/',
    // ui: { path: 'ui' },
    userDir: `${process.env.HOME}/.node-red-${VERSION}/`,
    functionGlobalContext: { }  // enables global context
  };

  RED.init(server, settings);

  // Serve the editor UI
  app.use(settings.httpAdminRoot, RED.httpAdmin);

  // Serve the http nodes UI
  app.use(settings.httpNodeRoot, RED.httpNode);

  server.listen(process.env.NODE_RED_PORT || 1880);

  // Start the runtime
  RED.start();
}
