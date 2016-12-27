'use strict';

angular.module('com.module.core')
.controller('ClustersCtrl', ClustersCtrl);

function ClustersCtrl($scope, $routeParams, PostsCluster, JobMonitor){

  $scope.jobMonitor = JobMonitor.findById({ id: $routeParams.id });

  $scope.clusters = PostsCluster.find({
    filter: {
      where: {
        job_monitor_id: $routeParams.id
      }
    }
  });
}
