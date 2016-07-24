'use strict';

const env = process.env;

module.exports = {
  //TODO: research loopback built-in mechanism for per-resource basic auth
  // resourceNames: plural name of resources
  auth(app, resourceNames) {
    if (+env.BASIC_AUTH_ON) {
      resourceNames.forEach(resourceName => {
        app.post('/api/' + resourceName, (req, res, next) => {
          const auth = {user: env.BASIC_AUTH_USER, pwd: env.BASIC_AUTH_PASS},
            b64auth = (req.headers.authorization || '').split(' ')[1] || '',
            login = new Buffer(b64auth, 'base64').toString().split(':'),
            user = login[0],
            pwd = login[1];

          if (!user || !pwd || user !== auth.user || pwd !== auth.pwd) {
            res.set('WWW-Authenticate', 'Basic realm="Watchman"');
            return res.status(401).send('denied');
          }
          next();
        });
      });
    }
  }
}
