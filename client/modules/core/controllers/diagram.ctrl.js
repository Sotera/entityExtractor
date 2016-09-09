angular.module('com.module.core')
  .controller('DiagramCtrl', DiagramCtrl);

function DiagramCtrl($scope, $routeParams, $window, PostsCluster, JobMonitor, SocialMediaPost) {
  $scope.cluster = undefined;
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
        result.similar_ids.forEach(function(i, el){
          unique.add(el);
        });
        result.similar_ids = unique;
        $scope.cluster = result;
      })
      .then(angular.noop)
      .catch(console.error);
  };
}
