const path = require('path');

module.exports = function(server) {
  server.set('views', path.join(__dirname, '../../client'));
  server.locals.basedir = server.get('views');
  server.set('view engine', 'jade');

  const router = server.loopback.Router(),
    viewsPath = 'modules/core/views';

  router.get('/', function(req, res, next) {
    res.render(viewsPath + '/pages/index');
  });

  router.get('/app/:view', function(req, res, next) {
    res.render(viewsPath + '/pages/' + req.params.view);
  });

  server.use(router);
};
