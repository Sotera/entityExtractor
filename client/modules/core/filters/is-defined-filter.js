'use strict';

angular.module('com.module.core')
.filter('isDefined', function() {
  return target => {
    return !_.isEmpty(target);
  };
});
