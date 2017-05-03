'use strict';

// def: wrapper for translators

require('dotenv').config({silent: true});

const app = require('../server/server'),
  Translator = require('mstranslator'),
  _ = require('lodash'),
  debug = require('debug')('translator');

// enums
const CACHE_TYPE = {
  detect: 'd',
  translate: 't'
};

// lazy instantiation
let client, TranslationCache;

module.exports = {
  translate(obj={text, to: 'en'}) {
    return query(obj, CACHE_TYPE.translate);
  },
  detect(obj={text}) {
    return query(obj, CACHE_TYPE.detect);
  }
};

// query cache with fallback to trans. service, and cache results.
function query(obj={text, to: 'en'}, cacheType) {
  const phrase = normalizeInput(obj.text);
  debug(phrase, cacheType);

  if (_.isEmpty(phrase))
    return Promise.reject(new Error('empty input'));

  client = client || new Translator({
    client_id: process.env.TRANSLATE_CLIENT_ID,
    client_secret: process.env.TRANSLATE_CLIENT_SECRET
  }, true); // true: auto-generate token

  TranslationCache = app.models.TranslationCache;

  return TranslationCache.findOne({
    where: { phrase, c_type: cacheType }
  })
  .then(cacheItem => {
    if (cacheItem) {
      debug('from cache', cacheItem);
      return cacheItem.res;
    } else {
      return doTranslate(obj, cacheType)
      .then(res => {
        debug('from service', res);
        // don't cache empty res
        if (_.isEmpty(res)) {
          return '';
        }
        return addToCache(phrase, cacheType, res)
        .then(cacheItem => cacheItem.res);
      });
    }
  });
}

function doTranslate(obj={text, to: 'en'}, cacheType) {
  let method = cacheType === CACHE_TYPE.detect ? 'detect' : 'translate';
  return new Promise((res, rej) => {
    client[method](obj, (err, t) => {
      if (err) return rej(err);
      return res(t);
    });
  });
}

function addToCache(place, cacheType, res) {
  return TranslationCache.create({
    phrase: normalizeInput(place),
    c_type: cacheType,
    res
  });
}

function normalizeInput(inp) {
  return inp.toString().trim().toLowerCase();
}
