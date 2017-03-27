'use strict';

// def: a websocket server with namespaced handlers.

require('dotenv').config({silent: true});

const debug = require('debug')('websocket');

module.exports = {
  start(app) {
    // basic http server should be enough
    const server = require('http').createServer(),
      port = process.env.WEBSOCKET_PORT || 4000,
      //TODO: move namespaces to settings?
      namespaces = [
        {
          path: '/threat',
          events: [
            { name: 'detect', handler: require('./handlers/threat-detection')['detect'] }
          ],
          broadcast: false // false == socket only
        }
      ];

    server.listen(port, err => {
      if (err) throw err;
      console.log('listening on %s', port);
    });

    app.io = require('socket.io')(server);

    // create listeners for each configured namespace.
    namespaces.forEach(obj => {
      let nsp = app.io.of(obj.path);

      nsp.on('connection', socket => {
        // broadcast or socket only?
        let chan = obj.broadcast ? nsp : socket;
        socket.on('disconnect', () => {
          debug('user disconnected from ' + obj.path);
        });

        debug('user connected to ' + obj.path);

        obj.events.forEach(handle);

        function handle(evt) {
          socket.on(evt.name, msg => {
            debug('got message: ' + msg);
            evt.handler(msg)
              .then(job => chan.emit(evt.name, job))
              .catch(err => {
                console.error(err);
                nsp.emit(evt.name, { error: err });
              });
          });
        }

      });
    });
  }
};
