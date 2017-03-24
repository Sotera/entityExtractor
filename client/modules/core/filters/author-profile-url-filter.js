'use strict';

angular.module('com.module.core')
.filter('authorProfileURL', function() {
  // TODO: other media sources than twitter
  return post => {
    if (!post.author_id) return;
    return `https:twitter.com/${post.author_id}`;
  };
});
