'use strict';

angular.module('com.module.core')
.controller('NavigationCtrl', NavigationCtrl);

function NavigationCtrl($scope, $window) {

  $scope.openKue = function() {
    let kueUrl = `//${window.location.hostname}:3002`;
    $window.open(kueUrl);
  };

}
