'use strict';

module.exports = function(Model, options) {

  Model.destroyData = function(cb) {
    Model.destroyAll()
    .then(() => cb(null, { data: 'All data destroyed' }))
    .catch(cb);
  };

  // 'destroy all' endpoint for dev convenience.
  Model.remoteMethod(
    'destroyData',
    {
      description: 'Destroy all records.',
      returns: { arg: 'data', root: true },
      http: { path: '/destroy-all', verb: 'post' }
    }
  );

  Model.destroyByIds = function(args, cb) {
    Model.destroyAll({
      id: {
        inq: args.ids
      }
    })
    .then(() => cb(null, { data: 'Data destroyed' }))
    .catch(cb);
  };

  // 'destroy selected' endpoint for dev convenience.
  Model.remoteMethod(
    'destroyByIds',
    {
      description: 'Destroy selected records by id.',
      accepts: {
        arg: 'args',
        type: 'object',
        description: 'object with "ids" property which is an array',
        required: true,
        http: { source: 'body' }
      },
      returns: { arg: 'data', root: true },
      http: { path: '/destroy', verb: 'post' }
    }
  );
};
