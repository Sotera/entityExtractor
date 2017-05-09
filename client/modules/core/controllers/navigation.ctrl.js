'use strict';

angular.module('com.module.core')
.controller('NavigationCtrl', NavigationCtrl);

function NavigationCtrl($scope, $window) {

  $scope.openKue = function() {
    let kueUrl = `//${window.location.hostname}:3002`;
    $window.open(kueUrl);
  };

  $scope.openNodeRed = function() {
    let nrUrl = `//${window.location.hostname}:1880/ui`;
    $window.open(nrUrl);
  };
}
