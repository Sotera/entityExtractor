'use strict';

angular.module('com.module.core')
.filter('isDefined', function() {
  return target => {
    return target != null && target != undefined && target.length>0;
  };
});
