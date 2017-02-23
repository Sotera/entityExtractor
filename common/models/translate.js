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
    translator.detect(args, (err, res) => {
      if (err) return cb(err);
      cb(null, [args.text, res]);
    });
  };

  Translate.toEnglish = (args, cb) => {
    translator.translateToEnglish(args.text, (err, res) => {
      if (err) return cb(err);
      cb(null, [args.text, res]);
    });
  };
};
