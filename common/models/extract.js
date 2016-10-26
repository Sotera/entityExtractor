'use strict';

var _ = require('lodash'),
  entityExtractor = require('../../lib/entity-extractor'),
  request = require('request-json-light'),
  neuralTalkClient = request.newClient('http://neuraltalk2:5000/');

module.exports = function(Extract) {

  Extract.remoteMethod(
    'entities',
    {
      description: 'Run entity extraction for given text',
      accepts: {
        arg: 'args',
        type: 'object',
        description: 'object with properties "text", "extract_type", "mime_type"',
        required: true,
        http: { source: 'body' }
      },
      returns: {type: 'array', root: true},
      http: {path: '/entities', verb: 'post'}
    }
  );

  Extract.entities = function(args, cb) {
    var mimeType = args.mime_type || 'text/html';
    var extractType = _.capitalize(args.extract_type || 'mitie');
    var method = 'extractWith' + extractType;
    var extract = entityExtractor[method](args.text, mimeType);

    extract
    .then(entities => cb(null, entities))
    .catch(err => cb(err));
  };

  Extract.remoteMethod(
    'addImageUrls',
    {
      description: 'Enqueue image urls for neuraltalk2 processing',
      accepts: {
        arg: 'image_urls',
        type: 'array',
        description: 'array of URLs to images',
        required: true,
        http: { source: 'body' }
      },
      returns: {type: 'object', root: true},
      http: {path: '/addimageurls', verb: 'post'}
    }
  );

  Extract.addImageUrls = function(image_urls, cb) {
    var adds = image_urls.map(url => {
      return new Promise((res, rej) => {
        neuralTalkClient.post('addURL/', { url: url }, (err, _, body) => {
          if (err) return rej(err);
          return res(body);
        });
      });
    });

    Promise.all(adds)
    .then(imgObjs => cb(null, imgObjs))
    .catch(cb);
  };

  Extract.remoteMethod(
    'getCaptions',
    {
      description: 'Get captions for neuraltalk2 processed images',
      accepts: {
        arg: 'ids',
        type: 'array',
        description: 'array of sha id\'s from previous "addimageurls" response',
        required: true,
        http: { source: 'body' }
      },
      returns: {type: 'object', root: true},
      http: {path: '/getcaptions', verb: 'post'}
    }
  );

  Extract.getCaptions = function(ids, cb) {
    var fetches = ids.map(id => {
      return new Promise((res, rej) => {
        neuralTalkClient.get('caption/' + id, (err, _, body) => {
          if (err) return rej(err);
          return res(body);
        });
      });
    });

    Promise.all(fetches)
    .then(captions => cb(null, captions))
    .catch(cb);
  };

  Extract.remoteMethod(
    'textract',
    {
      description: 'Run textract for given text, mime_type',
      accepts: {
        arg: 'args',
        type: 'object',
        description: 'object with properties "text", "mime_type"',
        required: true,
        http: { source: 'body' }
      },
      returns: {type: 'object', root: true},
      http: {path: '/textract', verb: 'post'}
    }
  );

  Extract.textract = function(args, cb) {
    var mimeType = args.mime_type || 'text/html';

    entityExtractor.extractText(args.text, mimeType)
    .then(text => cb(null, text))
    .catch(err => cb(err));
  };

  Extract.remoteMethod(
    'features',
    {
      description: 'Run feature extraction on archived images',
      accepts: {
        arg: 'args',
        type: 'object',
        description: 'object with properties "archive_url"',
        required: true,
        http: { source: 'body' }
      },
      returns: {type: 'string', root: true},
      http: {path: '/features', verb: 'post'}
    }
  );

  Extract.features = function(args, cb) {
    var archiveUrl = args.archive_url,
      jobId;

    jobId = entityExtractor.extractFeatures(archiveUrl);
    cb(null, jobId);
  };

};
