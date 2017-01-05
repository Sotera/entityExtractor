'use strict';

// def: misc. Promise-related tools

module.exports = {

  delay(interval) {
    return new Promise((res, rej) => {
      setTimeout(res, interval * 1000);
    });
  },

  // def: use promise values within ES6 generators.
  // see https://www.promisejs.org/generators/
  syncPromises(generatorFunc) {
    return function() {
      var generator = generatorFunc.apply(this, arguments);

      function handle(result) {
        // result => { done: [Boolean], value: [Object] }
        if (result.done) return Promise.resolve(result.value);

        return Promise.resolve(result.value)
        .then(function(res) {
          return handle(generator.next(res));
        }, function(err) {
          return handle(generator.throw(err));
        });
      }

      try {
        return handle(generator.next());
      } catch(ex) {
        return Promise.reject(ex);
      }
    };
  }

};
