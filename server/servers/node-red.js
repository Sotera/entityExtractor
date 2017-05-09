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
  const app = express();

  // Add a simple route for static content served from 'public'
  // app.use('/', express.static('public'));

  const server = http.createServer(app);

  // flow file name: local user or USER or ubuntu
  let user = process.env.NODE_RED_USER || process.env.USER || 'ubuntu',
    settings = {
    httpAdminRoot: '/',
    httpNodeRoot: '/',
    // from proj root
    userDir: `./deploy/node-red-${VERSION}`,
    flowFile: `flows_${user}.json`,
    // for using global.get('process').env in nodes
    functionGlobalContext: { process }
  };

  RED.init(server, settings);

  // Serve the editor UI
  app.use(settings.httpAdminRoot, RED.httpAdmin);

  // Serve the http nodes UI
  app.use(settings.httpNodeRoot, RED.httpNode);

  server.listen(process.env.NODE_RED_PORT || 1880);

  RED.start();
}
