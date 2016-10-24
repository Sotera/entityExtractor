angular.module('com.module.core')
  .controller('DiagramCtrl', DiagramCtrl);

function DiagramCtrl($scope, PostsCluster, SocialMediaPost, $q) {
  $scope.clusterText = '';
  $scope.clusterTerm = '';

  // obj: represents a cluster but not a loopback model
  $scope.visualizeCluster = function(obj) {
    PostsCluster.findOne({
      filter: {
        where: {
          id: obj.id
        }
      }
    }).$promise
      .then(function(cluster) {
        var viz = visualize(cluster);

        // apparently there are dupes?
        cluster.similar_ids = _.uniq(cluster.similar_ids);

        if (cluster.data_type === 'text'){
          viz.forText();
        } else if (cluster.data_type === 'hashtag'){
          viz.forHashtags();
        } else if (cluster.data_type === 'image'){
          viz.forImages();
        }
      })
      .catch(console.error);
  };

  $scope.dateRangeSelected = function(start, end) {
    $scope.showSpinner = true;
    $q.all([
      $scope.loadNetworkGraph(start, end),
      $scope.loadCommunityGraph(start, end)
    ])
    .then(function() {
      $scope.showSpinner = false;
    })
    .catch(console.error);
  };

  // 'visualize': show me the details
  $scope.visualize = visualize;

  function visualize(clusters) {
    if (!_.isArray(clusters)) clusters = [clusters];

    var functions = {
      forText() {
        $scope.showSpinner = true;

        $scope.clusterText = '';

        var similar_ids = _(clusters).map('similar_ids')
          .flatten().compact().uniq().value();

        var ids = _.sampleSize(similar_ids, 100);

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
      },

      forHashtags() {
        var terms = _(clusters).map('term')
          .flatten().compact().value().join(', ');

        $scope.clusterTerm = terms;
      },

      forImages() {
        var imageUrls = _(clusters).map('similar_image_urls')
          .flatten().compact().value();

        if (imageUrls.length) {
          $scope.imageUrls = imageUrls;
        } else {// TODO: should only get here if bad/missing data?
          $scope.imageUrls = null;
          console.info('no similar_image_urls');
        }
      },

      forAll() {
        this.forText()
        this.forHashtags()
        this.forImages();
      }
    };

    return functions;
  }
}
