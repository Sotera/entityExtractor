angular.module('com.module.core', [])

// silence angular leaflet console messages
// does it affect other modules?
.config(function($logProvider){
  $logProvider.debugEnabled(false);
});;
