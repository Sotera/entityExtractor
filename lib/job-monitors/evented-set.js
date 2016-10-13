'use strict';

const EventEmitter = require('events').EventEmitter,
  util = require('util');

module.exports = EventedSet;

util.inherits(EventedSet, EventEmitter);

function EventedSet() {
  // TODO: use Redis set instead
  this.set = new Set();
  Object.defineProperty(this, 'size', {
    get() { return this.set.size; }
  });
}

EventedSet.prototype.add = function(item) {
  if (!this.set.has(item)) {
    this.emit('added', item);
  }
  return this.set.add(item);
};

EventedSet.prototype.delete = function(item) {
  if (this.set.has(item)) {
    this.set.delete(item);
    if (this.set.size === 0) {
      this.emit('emptied');
    }
  }
};

EventedSet.prototype.values = function() {
  return this.set.values();
};

EventedSet.prototype.has = function(key) {
  return this.set.has(key);
};
