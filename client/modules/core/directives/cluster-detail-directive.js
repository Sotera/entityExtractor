'use strict';

angular.module('com.module.core')
.directive('clusterDetail', clusterDetailDirective);

// show posts' details for selected cluster
function clusterDetailDirective(SocialMediaPost, $window) {

  return {
    link: link,
    templateUrl: '/app/partials/cluster-detail'
  };

  function link(scope, element, attrs) {
    scope.showClusterDetail = function(cluster) {
      cluster.similar_ids.forEach(function(postId) {
        showPostDetail($('#post-' + postId), postId);
      });
    };

    scope.openImage = function(evt) {
      const $target = $(evt.target);
      $window.open($target.attr('src'));
      console.info($target.data('post-url'));
    };

    scope.openOrigPost = function(evt) {
      const $target = $(evt.target);
      $window.open($target.data('post-url'));
    };

    function showPostDetail(target, postId) {
      SocialMediaPost.findOne({
        filter: {
          where: {
            id: postId
          },
          fields: ['primary_image_url', 'text', 'hashtags', 'post_url', 'domains']
        }
      })
      .$promise
      .then(function(post) {
        const $target = $(target);
        $target.data('post-url', post.post_url);

        switch(scope.jobMonitor.featurizer) {
          case 'image':
            $target.attr('src', post.primary_image_url);
            break;
          case 'text':
            $target.text(post.text);
            break;
          case 'domain':
            $target.text(post.domains);
            break;
          case 'hashtag':
            $target.text(post.hashtags);
            break;
        }
      })
      .catch(console.error);
    }
  }

}
