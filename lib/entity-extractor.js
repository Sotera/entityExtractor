// def: wrapper for entity extractors
'use strict';

var app = require('../server/server'),
  fs = require('fs'),
  path = require('path'),
  url = require('url'),
  tmpPath = '../temp/',
  mkdirp = require('mkdirp'),
  StanNer = require('node-ner'),
  request = require('request'),
  requestJson = require('request-json-light'),
  textract = require('textract'),
  syncPromises = require('../server/util/generator-promises'),
  _ = require('lodash'),
  stanNer = new StanNer({
    install_path: path.join(__dirname, '../stanford-ner-2014-10-26')
  }),
  mitieUrl = 'http://mitie:8888/', // dev tip: add mitie to /etc/hosts
  redis = require('./redis'),
  fsutil = require('./fsutil'),
  strf = require('string-template')
  ;

mkdirp(path.join(__dirname, tmpPath), err => {
  if (err) console.error(err);
});

module.exports = {

  extractFeatures(archiveUrl) {
    var parsed = url.parse(archiveUrl),
      idGen = require('./id-generator'),
      archiveReq = request(archiveUrl),
      jobId = 'features:' + idGen.randomish(),
      downloadFile = strf('/tmp/{0}-{1}', jobId, path.basename(parsed.pathname)),
      downloadStream = fs.createWriteStream(downloadFile, 'binary')
      ;

    downloadStream.on('pipe', src => {
      redis.hmset(jobId, {
        url: archiveUrl, file: downloadFile, state: 'downloading'
      })
      .then(res => {
        console.log(res, jobId);
      })
      .catch(err => {
        console.error(err);
      });
    });

    archiveReq.on('end', () => {
      //TODO
      // fsutil.decompress(downloadFile))
      redis.hmset(jobId, {
        state: 'downloaded',
        data: JSON.stringify({a: 1})
        // , path: path TODO
      })
      .then(res => {
        console.log(res, jobId);
      })
      .then(() => {
        redis.publish('features', jobId);
      })
      .catch(err => {
        console.error(err);
      });
    });

    archiveReq.pipe(downloadStream);
    return jobId;
  },

  extractWithMitie(text, mimeType) {
    mimeType = mimeType || 'text/html';
    var context = this;
    return syncPromises(function* () {
      text = yield context.extractText(text, mimeType);
      return context.requestMitie(text);
    })();
  },

  requestMitie(text) {
    var client = requestJson.newClient(mitieUrl);
    text = text.replace(/[^\x00-\x7F]/g, ''); // rm non-ascii for mitie
    return new Promise((res, rej) => {
      client.post('ner', { text: text }, (err, _, body) => {
        if (err) {
          console.error(err);
          return rej(err);
        }
        console.log(body);
        res(body.entities);
      });
    });
  },

  extractText(dirtyText, mimeType) {
    return new Promise((res, rej) => {
      var buf = new Buffer(dirtyText, 'utf-8'); // assume utf8
      textract.fromBufferWithMime(mimeType, buf, (err, text) => {
        if (err) {
          console.error('textract err:', err);
          return rej(err);
        }
        res(text);
      });
    });
  },

  extractWithStanford(text, mimeType) {
    mimeType = mimeType || 'text/html';
    var filePath = path.join(__dirname, tmpPath + '/data' + Date.now() + '.txt');
    return new Promise(function(resolve,reject){
      textract.fromBufferWithMime(mimeType, new Buffer(text), function(err, data) {
        if (err) {
          console.error(err);
          return reject(err);
        }
        fs.writeFile(filePath, data, err => {
          if (err) {
            console.error(err);
            return reject(err);
          }
          console.log("file saved");

          stanNer.fromFile(filePath, entities => {
            fs.unlink(filePath, err => {
              if (err) {
                console.error(err);
                return reject(err);
              }
              console.log("File deleted successfully!");
            });
            resolve(entities);
          });
        });
      });
    });
  },

  // args:
  // defaults:
    // date: default date if not extracted
    // mimeType: for textract
  //TODO: combine with mitie eventize
  eventizeWithStanford(text, defaults) {
    defaults = defaults || {};
    var models = app.models;
    var ParsedEvent = models.ParsedEvent;
    var Geocoder = models.Geocoder;

    return this.extractWithStanford(text, defaults.mimeType)
    .then(entities => {
      var newEvent = {
        people: entities.PERSON,
        organizations: entities.ORGANIZATION,
        dates: entities.DATE,
        locations: entities.LOCATION,
        sourceText: text
      };
      // newEvent.message = JSON.stringify(entities);
      newEvent.message = text;
      if (!(newEvent.dates && newEvent.dates.length)) {
        newEvent.dates = [defaults.date];
      }

      return ParsedEvent.create(newEvent);
    })
    .then(parsedEvent => {
      return Geocoder.geocodeEvent(parsedEvent.id);
    });
  },

  // args:
  // defaults:
    // date: default date if not extracted
    // mimeType: for textract
  eventizeWithMitie(text, defaults) {
    defaults = defaults || {};
    var models = app.models;
    var ParsedEvent = models.ParsedEvent;
    var Geocoder = models.Geocoder;

    function extract(entities, tag) {
      return _(entities)
      .filter(item => item.tag === tag)
      .map('label').uniq().value();
    }

    return this.extractWithMitie(text, defaults.mimeType)
    .then(entities => {
      var newEvent = {
        people: extract(entities, 'PERSON'),
        organizations: extract(entities, 'ORGANIZATION'),
        dates: extract(entities, 'DATE'),
        locations: extract(entities, 'LOCATION'),
        sourceText: text
      };
      newEvent.message = text;
      if (!(newEvent.dates && newEvent.dates.length)) {
        newEvent.dates = [defaults.date];
      }

      return ParsedEvent.create(newEvent);
    })
    .then(parsedEvent => {
      return Geocoder.geocodeEvent(parsedEvent.id);
    });
  },

  // args:
  // defaults:
    // date: default date if not extracted
    // link: for display
    // text: for display
    // photoId: from flickr
  eventizeWithNeuralTalk2(imageUrl, defaults) {
    defaults = defaults || {};
    var models = app.models;
    var ParsedEvent = models.ParsedEvent;
    var Extract = models.Extract;

    return new Promise((res, rej) => {
      // assumes flickr image. geocode with flickr api.
      var flickrEndpoint = 'https://api.flickr.com/services/rest/';
      var flickrQuery = {
        method: 'flickr.photos.geo.getLocation',
        api_key: process.env.FLICKR_API_KEY,
        format: 'json',
        nojsoncallback: 1,
        photo_id: defaults.photoId
      };

      request.get({url: flickrEndpoint, qs: flickrQuery}, (err, _, body) => {
        if (err) return rej(err);

        body = JSON.parse(body);
        console.log(body)
        if (body.photo) {
          var loc = body.photo.location;
          res({lat: loc.latitude, lng: loc.longitude});
        } else {
          res();
        }
      });
    })
    .then(coords => {
      // return if not geolocated
      if (!coords) return;
      return new Promise((res, rej) => {
        Extract.addImageUrls([imageUrl], (err, items) => {
          if (err) return rej(err);
          var ids = _.map(items, 'sha256sum');

          setTimeout(() => { // wait for neuraltalk process to finish
            Extract.getCaptions(ids, (err, items) => {
              if (err) return rej(err);

              var img = items[0];
              res({
                caption: img.caption || img.error, // when neuraltalk2 fails, it adds error prop
                coords: coords
              });
            });
          }, 25 * 1000);
        });
      });
    })
    .then(imgObj => {
      // return if prev step returned null
      if (!imgObj) return;
      var caption = imgObj.caption;
      var newEvent = {
        dates: [defaults.date],
        sourceText: defaults.text,
        lat: imgObj.coords.lat,
        lng: imgObj.coords.lng,
        geocoded: true
      };
      newEvent.message = defaults.text +
      "<br/><a target='_blank' href='" + defaults.link + "'>" +
      "<img width='100px' src='" + imageUrl + "'/></a><br/><p>" +
      caption + "</p>";

      return ParsedEvent.create(newEvent);
    });
  }
};
