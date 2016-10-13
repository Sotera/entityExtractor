
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
    templateUrl: '/app/pages/home'
  })
  .when('/job-monitors', {
    templateUrl: '/app/pages/job-monitors',
    controller: 'JobMonitorsCtrl',
    reloadOnSearch: false
  })
  .when('/job-monitors/:id/clusters', {
    templateUrl: '/app/pages/clusters',
    controller: 'ClustersCtrl'
  })
  .when('/parser', {
    templateUrl: '/app/pages/parser',
    controller: 'ParserCtrl'
  })
  .when('/diagram', {
    templateUrl: '/app/pages/diagram',
    controller: 'DiagramCtrl'
  });

  // configure html5 to get links working on jsfiddle
  // $locationProvider.html5Mode(true);
});
