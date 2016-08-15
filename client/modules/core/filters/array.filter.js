angular.module('com.module.core')
.filter('htmlBreaks', function() {
  return function(arr) {
    return arr.join('<br>');
  };
})
;
