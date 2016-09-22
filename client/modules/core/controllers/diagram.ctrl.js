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
      .then(function(cluster) {
        var unique = new Set();
        cluster.similar_ids.forEach(function(id){
          unique.add(id);
        });
        cluster.similar_ids = [...unique];
        if (cluster.data_type === "text"){
          $scope.getClusterText(cluster);
        } else if (cluster.data_type === "hashtag"){
          $scope.getClusterHashtags(cluster);
        } else if (cluster.data_type === "image"){
          $scope.getClusterImages(cluster);
        }

        $scope.cluster = cluster;
      })
      .catch(console.error);
  };

  $scope.dateRangeSelected = function(start,end){
    $scope.loadNetworkGraph(start,end);
  };


  $scope.getClusterText = function(cluster) {
    $scope.showSpinner = true;

    $scope.clusterText = "";
    var ids = cluster.similar_ids.slice(0,50);
    SocialMediaPost.find({
      filter: {
        where: {
          id: {inq: ids}
        }
      }
    }).$promise
      .then(posts => {
        var allText = posts.map(p => p.text).join(' ');
        $scope.clusterText = allText;
        $scope.showSpinner = false;
      })
      .catch(console.error);
  };

  //cheat a bit here just to show the hashtag in the cloud
  $scope.getClusterHashtags = function(cluster) {
    $scope.clusterTerm = cluster.term;
  };

  $scope.getClusterImages = function(cluster) {
    if (cluster.similar_image_urls) {
      $scope.imageUrls = cluster.similar_image_urls;
    } else {// TODO: should only get here if bad/missing data?
      $scope.imageUrls = null;
      alert('similar_image_urls not provided');
    }
  };
}
