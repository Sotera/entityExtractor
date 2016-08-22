angular.module('com.module.core')
  .controller('JobMonitorsCtrl', JobMonitorsCtrl);

function JobMonitorsCtrl($scope, $window, JobMonitor, PostsCluster) {
  var limitOptions = [10, 50, 100, 200];

  angular.extend($scope, {
    limitOptions: limitOptions,
    limit: limitOptions[0],
    totalClustersCount: PostsCluster.count(),
    changeLimit: changeLimit
  });

  function changeLimit() {
    JobMonitor.find({
      filter: {
        limit: $scope.limit,
        order: 'start_time desc',
        include: 'postsClusters'
      }
    })
    .$promise
    .then(function(jobMonitors) {
      $scope.jobMonitors = jobMonitors;
      $scope.clustersCount = jobMonitors
        .map(getClusters)
        .reduce(sum, 0);
    });
  }

  changeLimit();

  function getClusters(jobMonitor) {
    return jobMonitor.postsClusters;
  }

  function sum(prev, curr) {
    return prev + curr.length;
  }
}
