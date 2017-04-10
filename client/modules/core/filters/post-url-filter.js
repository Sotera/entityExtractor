'use strict';

// def: craft links to source posts.

angular.module('com.module.core')
.filter('authorProfileURL', function() {
  // TODO: other media sources than twitter
  return post => {
    if (!post.screen_name) return;
    return `https://twitter.com/${post.screen_name}`;
  };
})

.filter('statusUrl', function() {
  // TODO: other media sources than twitter
  return id => {
    if (!id) return;
    return `https://twitter.com/statuses/${id}`;
  };
});
