'use strict';

angular.module('com.module.core')
.filter('sampleWeightedPairs', function() {
  // hashtags, keywords have structure [[word(string), weight(int)], ...]
  return pairs => {
    if (!pairs) return;
    // assumes already sorted by weight
    return pairs.slice(0,2).map(ht => ht[0]).join(', ');
  };
});
