angular.module('com.module.core')
  .controller('DiagramCtrl', DiagramCtrl);

function DiagramCtrl($scope, PostsCluster, SocialMediaPost) {
  $scope.cluster = undefined;
  $scope.clusterText = "";
  $scope.clusterTerm = "";

  $scope.showDetails = function(evt) {
    $scope.clusterText = "";
    $scope.clusterTerm = "";

    $scope.clusters = PostsCluster.findOne({
      filter: {
        where: {
          id: evt.id
        }
      }
    }).$promise
      .then(function(result){
        var unique= new Set();
        result.similar_ids.forEach(function(el, i){
          unique.add(el);
        });
        result.similar_ids = [...unique];
        if(result.data_type ==="text"){
          $scope.getClusterText(result);
        }
        else if(result.data_type ==="hashtag"){
          $scope.getClusterHashtags(result);
        }

        $scope.cluster = result;
      })
      .then(angular.noop)
      .catch(console.error);
  };

  $scope.getClusterText = function(cluster){
    $scope.clusterText = "";
    var ids = cluster.similar_ids.slice(0,10);
    ids.forEach(function(el, i){
      SocialMediaPost.findOne({
        filter: {
          where: {
            id: el
          }
        }
      }).$promise
        .then(function(post){
          $scope.clusterText += post.text;
        })
        .then(angular.noop)
        .then(angular.noop)
        .catch(console.error);
    });
  };

  //cheat a bit here just to show the hashtag in the cloud
  $scope.getClusterHashtags = function(cluster){
    $scope.clusterTerm = cluster.term;
  };
}
