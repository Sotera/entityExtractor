'use strict';

angular.module('com.module.core')
.controller('IndicationsCtrl', IndicationsCtrl);

function IndicationsCtrl($scope, SocialMediaPost, $q) {
  $scope.clusterText = '';
  $scope.clusterTerm = '';
  $scope.terms = ["trump","missile","the"];
  $scope.dateRangeSelected = function(start, end) {
    $scope.showSpinner = true;
    $q.all([
      //$scope.loadNetworkGraph(start, end),
      //$scope.loadCommunityGraph(start, end)
    ])
    .then(function() {
      $scope.showSpinner = false;
    })
    .catch(console.error);
  };

}
