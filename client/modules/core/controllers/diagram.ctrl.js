'use strict';

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
    })
    .$promise
    .then(function(cluster) {
      let viz = visualize(cluster);

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

    function sampleSocialMediaPosts(dataType, sampleSize=100) {
      let similarPostIds = _(clusters).map('similar_post_ids')
        .flatten().compact().uniq().value();

      similarPostIds = _.sampleSize(similarPostIds, sampleSize);

      return SocialMediaPost.find({
        filter: {
          where: {
            post_id: { inq: similarPostIds },
            featurizer: dataType
          },
          fields: ['text', 'image_urls', 'hashtags', 'primary_image_url']
        }
      }).$promise;
    }

    let functions = {
      forText() {
        $scope.showSpinner = true;

        $scope.clusterText = '';

        sampleSocialMediaPosts('text')
        .then(posts => {
          let allText = posts.map(p => p.text).join(' ');
          $scope.clusterText = allText;
          $scope.showSpinner = false;
        })
        .catch(console.error);
      },

      forHashtags() {
        let terms = _(clusters).map('term')
          .flatten().compact().value().join(', ');

        $scope.clusterTerm = terms;
      },

      forImages() {
        $scope.showSpinner = true;

        sampleSocialMediaPosts('image', 200)
        .then(posts => {
          let imageUrls = _(posts).map('primary_image_url')
            .compact().uniq().value();

          if (imageUrls.length) {
            $scope.imageUrls = imageUrls;
          } else {
            $scope.imageUrls = null;
            console.info('no similar_image_urls');
          }

          $scope.showSpinner = false;
        })
        .catch(console.error);
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
