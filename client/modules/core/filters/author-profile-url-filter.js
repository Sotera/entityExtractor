'use strict';

angular.module('com.module.core')
.filter('authorProfileURL', function() {
  // TODO: other media sources than twitter
  return post => {
    if (!post.screen_name) return;
    return `https:twitter.com/${post.screen_name}`;
  };
});
