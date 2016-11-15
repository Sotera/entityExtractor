module.exports = function(Model, options) {

  Model.destroyData = function(args, cb) {
    Model.destroyAll({'id':{'inq': args.ids}})
      .then(() => cb(null, { data: 'Data destroyed' }))
      .catch(cb);
  };

  // 'destroy all' endpoint for dev convenience.
  // TODO: use POST method instead
  Model.remoteMethod(
    'destroyData',
    {
      description: 'Destroy select records.',
      accepts: {
        arg: 'args',
        type: 'object',
        description: 'object with "ids" property which is an array of ids',
        required: true,
        http: { source: 'body' }
      },
      returns: { arg: 'data', root: true },
      http: { path: '/destroy', verb: 'post' }
    }
  );

};
