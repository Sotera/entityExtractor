module.exports = function(FeedObject) {

  FeedObject.destroyData = function(cb) {
    FeedObject.destroyAll()
      .then(() => cb(null, {data: 'All data destroyed'}))
      .catch(cb);
  };

  FeedObject.remoteMethod(
    'destroyData',
    {
      accepts: [
      ],
      returns: {arg: 'data', root: true},
      http: {path: '/destroy',verb: 'get'}
    }
  );
};
