'use strict';

const path = require('path');

module.exports = function(server) {
  server.set('views', path.join(__dirname, '../../client'));
  server.locals.basedir = server.get('views');
  server.set('view engine', 'jade');

  const router = server.loopback.Router(),
    viewsPath = 'modules/core/views';

  router.get('/', function(req, res, next) {
    res.render(path.join(viewsPath, '/pages/index'));
  });

  // allows for /app/pages/mypage, /app/templates/blah, etc.
  router.get('/app/*?', function(req, res, next) {
    res.render(path.join(viewsPath, req.params[0]));
  });

  // demo pages
  router.get('/demo/topics*', function(req, res, next) {
    const filePath = path.resolve(
      path.join(server.get('views'), viewsPath, 'demo/topics.html')
    );
    res.sendFile(filePath);
  });

  router.get('/demo/*?', function(req, res, next) {
    res.render(path.join(viewsPath, 'demo', req.params[0]));
  });

  server.use(router);
};
