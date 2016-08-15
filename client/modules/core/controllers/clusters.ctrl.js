angular.module('com.module.core')
  .controller('ClustersCtrl', ClustersCtrl);

function ClustersCtrl($scope, PostsCluster, SocialMediaPost) {
  $scope.clusters = PostsCluster.find({
    filter: {
      include: 'jobMonitor'
    }
  });

  $scope.showPostDetails = function(evt, postId) {
    var target = evt.target;
    SocialMediaPost.findById({id: postId})
    .$promise
    .then(function(post) {
      $(target).text(post.text);
    });
  };
}
