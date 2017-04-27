'use strict';

angular.module('com.module.core')
.controller('IndicationsCtrl', IndicationsCtrl);

function IndicationsCtrl($scope, SocialMediaPost, $q) {
  $scope.clusterText = '';
  $scope.clusterTerm = '';
  $scope.terms = ["assad","missile","syria","putin"];
  $scope.removeTerm = function(term){
    $scope.terms.splice($scope.terms.indexOf(term),1);
  };
  $scope.addTerm = function(term){
    if($scope.terms.indexOf(term) >=0)return;
    $scope.terms.push(term);
  };
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
