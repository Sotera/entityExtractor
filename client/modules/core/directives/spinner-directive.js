'use strict';

angular.module('com.module.core')
.directive('spinner', spinnerDirective);

function spinnerDirective() {

  return {
    restrict: 'E',
    scope: {
      show: '='
    },
    link: link,
    template: "<div style='position:relative'></div>"
  };

  // from the spin.js docs with a few mods
  var opts = {
      lines: 13 // The number of lines to draw
    , length: 28 // The length of each line
    , width: 14 // The line thickness
    , radius: 42 // The radius of the inner circle
    , scale: 1 // Scales overall size of the spinner
    , corners: 1 // Corner roundness (0..1)
    , color: '#000' // #rgb or #rrggbb or array of colors
    , opacity: 0.35 // Opacity of the lines
    , rotate: 0 // The rotation offset
    , direction: 1 // 1: clockwise, -1: counterclockwise
    , speed: 1 // Rounds per second
    , trail: 60 // Afterglow percentage
    , fps: 20 // Frames per second when using setTimeout() as a fallback for CSS
    , zIndex: 2e9 // The z-index (defaults to 2000000000)
    , className: 'spinner' // The CSS class to assign to the spinner
    , top: '50%' // Top position relative to parent
    , left: '50%' // Left position relative to parent
    , shadow: true // Whether to render a shadow
    , hwaccel: true // Whether to use hardware acceleration
    , position: 'absolute' // Element positioning
  };

  function link(scope, elem, attrs) {
    var spinner = scope.spinner = new Spinner(opts);

    scope.$watch('show',
      function(newVal) {
        // undefined or null indicates not yet set.
        // expects bool values.
        if (newVal == null) return;
        if (newVal) {
          spinner.spin(elem[0]);
        } else {
          spinner.stop();
        }
      }
    );
  }
}
