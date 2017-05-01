'use strict';

const translator = require('../../lib/translator');

module.exports = function(Translate) {

  Translate.remoteMethod(
    'toEnglish',
    {
      description: 'Translate text to English',
      accepts: {
        arg: 'args',
        type: 'object',
        description: 'object with "text" property',
        required: true,
        http: { source: 'body' }
      },
      returns: {type: 'array', root: true},
      http: {path: '/en', verb: 'post'}
    }
  );

  Translate.remoteMethod(
    'detect',
    {
      description: 'Detect lang in text',
      accepts: {
        arg: 'args',
        type: 'object',
        description: 'object with "text" property',
        required: true,
        http: { source: 'body' }
      },
      returns: {type: 'array', root: true},
      http: {path: '/detect', verb: 'post'}
    }
  );

  Translate.detect = (args, cb) => {
    translator.detect(args)
    .then(res => cb(null, [args.text, res]))
    .catch(cb);
  };

  Translate.toEnglish = (args, cb) => {
    translator.translate({text: args.text, to: 'en'})
    .then(res => cb(null, [args.text, res]))
    .catch(cb);
  };

  //TODO: Translate.trans for other 'to' langs
};
