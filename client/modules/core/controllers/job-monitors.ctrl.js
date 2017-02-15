'use strict';

angular.module('com.module.core')
.controller('JobMonitorsCtrl', JobMonitorsCtrl);

function JobMonitorsCtrl($scope, $window, JobMonitor, PostsCluster,
  $routeParams, $location) {
  var limitOptions = [10, 50, 100, 200],
    typeOptions = ['all', 'text', 'domain', 'hashtag', 'image', 'linker'],
    limit = +($routeParams.limit || limitOptions[0]),
    type = $routeParams.type || typeOptions[0];

  $scope.$watch('limit', function(_limit) {
    if (_limit) {
      limit = _limit;
      $location.search('limit', limit);
      slowlyGetJobMonitors({limit: limit, type: type});
    }
  });

  $scope.$watch('type', function(_type) {
    if (_type) {
      type = _type;
      $location.search('type', type);
      slowlyGetJobMonitors({limit: limit, type: type});
    }
  });

  angular.extend($scope, {
    limitOptions: limitOptions,
    typeOptions: typeOptions,
    limit: limit,
    type: type,
    totalClustersCount: PostsCluster.count()
  });

  // prevent watchers from duplicating expensive db call.
  // delay time isn't especially important in this case.
  const slowlyGetJobMonitors = _.throttle(
    getJobMonitors,
    1000,
    { leading: true, trailing: false }
  );

  function getJobMonitors(params={limit: 10, type: null}) {
    var filter = {
      limit: params.limit,
      order: 'start_time desc',
      include: 'postsClusters',
      where: {}
    };

    if (params.type !== 'all')
      filter.where.featurizer = params.type;

    JobMonitor.find({filter: filter})
    .$promise
    .then(function(jobMonitors) {
      $scope.jobMonitors = jobMonitors;
      $scope.clustersCount = jobMonitors
        .map(getClusters)
        .reduce(sum, 0);
    });
  }

  function getClusters(jobMonitor) {
    return jobMonitor.postsClusters;
  }

  function sum(prev, curr) {
    return prev + curr.length;
  }
}
