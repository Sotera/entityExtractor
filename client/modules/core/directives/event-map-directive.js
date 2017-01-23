'use strict';

angular.module('com.module.core')
.directive('eventMap', eventMapDirective);

function eventMapDirective() {
  return {
    controller: eventMapController,
    link: link
  };

  function link(scope, elem, attrs, ctrls) {

    scope.$watch(attrs['ngModel'], function (features) {
      var options = {
        tiles: {
          url: "http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        },
        markers:features,
        geojson: {}
      };
      loadMap(options);
    });

    var map = $('#map-frame')[0];
    map = map.contentWindow? map.contentWindow : map.contentDocument.defaultView;

    function loadMap(options){
      map.postMessage(options,"*");
    }
  }
}

function eventMapController($scope, ClusterLink, PostsCluster) {
  this.create = create;
  function create(event, callback) {

  }



}
