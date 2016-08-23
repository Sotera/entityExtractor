angular.module('com.module.core')
  .controller('ClustersCtrl', ClustersCtrl);

function ClustersCtrl($scope, $routeParams, $window, PostsCluster, JobMonitor, SocialMediaPost) {
  $scope.jobMonitor = JobMonitor.findById({ id: $routeParams.id });

  $scope.clusters = PostsCluster.find({
    filter: {
      where: {
        job_monitor_id: $routeParams.id
      }
    }
  });

  $scope.showPostDetails = function(evt, postId) {
    var target = evt.target;

    SocialMediaPost.findById({ id: postId })
    .$promise
    .then(function(post) {
      switch($scope.jobMonitor.featurizer) {
        case 'image':
          $window.open(post.image_urls[0].expanded_url);
          break;
        case 'text':
          $(target).text(post.text);
          break;
        case 'hashtag':
          $(target).text(post.hashtags);
          break;
      }
    });
  };
}
