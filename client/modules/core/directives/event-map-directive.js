'use strict';

angular.module('com.module.core')
.directive('eventMap', eventMapDirective);

function eventMapDirective() {
  return {
    link: link
  };

  function link(scope, elem, attrs) {
    scope.$watch(attrs['points'], function(points) {
      if (!points) return;

      let options = {
        tiles: {
          url: 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        },
        markers: points,
        geojson: {}
      };
      loadMap(options);
    });

    let map = $('#map-frame')[0];
    map = map.contentWindow? map.contentWindow : map.contentDocument.defaultView;

    function loadMap(options){
      map.postMessage(options, '*');
    }
  }
}
