'use strict';

// def: wrap 3rd party geocoder services

const app = require('../server/server'),
  debug = require('debug')('geocoder'),
  _ = require('lodash'),
  geocoderProvider = 'openstreetmap',
  protocol = 'https',
  // optional
  extra = {
    apiKey: 'YOUR_API_KEY', // for Mapquest, OpenCage, Google Premier
    formatter: null         // 'gpx', 'string', ...
  };

let GeoCache;

const geocoder = require('node-geocoder')(geocoderProvider, protocol, extra);

module.exports = {
  geocode(place) {
    return find(place);
  }
};

// query cache with fallback to geo service, and cache results.
function find(place) {
  place = normalizeInput(place);
  GeoCache = app.models.GeoCache;

  return GeoCache.findOne({
    where: { place }
  })
  .then(cacheItem => {
    debug('from cache', cacheItem);
    if (cacheItem) {
      return cacheItem.res;
    } else {
      return geocode(place)
      .then(res => {
        debug('from service', res);
        // don't cache empty res
        if (_.isEmpty(res)) {
          return [];
        }
        return addToCache(place, res)
        .then(cacheItem => cacheItem.res);
      });
    }
  });
}

function geocode(place) {
  return geocoder.geocode(place);
}

function addToCache(place, res) {
  // cache only the top result to reduce storage
  res = res.slice(0, 1);
  return GeoCache.create({place: normalizeInput(place), res});
}

function normalizeInput(inp) {
  return inp.toString().toLowerCase();
}
