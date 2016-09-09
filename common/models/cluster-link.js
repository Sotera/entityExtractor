module.exports = function(ClusterLink) {

  ClusterLink.destroyData = function(cb) {
    ClusterLink.destroyAll()
      .then(() => cb(null, {data: 'All data destroyed'}))
      .catch(cb);
  };

  ClusterLink.remoteMethod(
    'destroyData',
    {
      accepts: [
      ],
      returns: {arg: 'data', root: true},
      http: {path: '/destroy', verb: 'get'}
    }
  );

};
