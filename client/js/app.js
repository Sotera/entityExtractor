
angular.module('watchman', [
  'ngResource',
  'lbServices',
  'leaflet-directive',
  'ngRoute',
  'com.module.core'
])

.run(function ($rootScope) {})

.config(function($routeProvider, $locationProvider) {
  $routeProvider
  .when('/', {
    templateUrl: '/app/home'
  })
  .when('/clusters', {
    templateUrl: '/app/clusters',
    controller: 'ClustersCtrl'
  })
  .when('/parser', {
    templateUrl: '/app/parser',
    controller: 'ParserCtrl'
  })

  // configure html5 to get links working on jsfiddle
  // $locationProvider.html5Mode(true);
});
