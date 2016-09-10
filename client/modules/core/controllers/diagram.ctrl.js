angular.module('com.module.core')
  .controller('DiagramCtrl', DiagramCtrl);

function DiagramCtrl($scope, $routeParams, $window, PostsCluster, JobMonitor, SocialMediaPost) {
  $scope.cluster = undefined;
  $scope.clusterText = "";

  $scope.showDetails = function(evt) {
    $scope.clusters = PostsCluster.findOne({
      filter: {
        where: {
          id: evt.id
        }
      }
    }).$promise
      .then(function(result){
        var unique= new Set();
        if(result.data_type ==="text"){
          result.similar_ids.forEach(function(el, i){
            unique.add(el);
          });
          result.similar_ids = [...unique];
          $scope.getClusterText(result);
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
        .catch(console.error);
    });
  };
}
