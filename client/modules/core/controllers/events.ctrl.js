'use strict';

angular.module('com.module.core')
.controller('EventsCtrl', EventsCtrl);

function EventsCtrl($scope, PostsCluster, SocialMediaPost) {
  $scope.eventPoints = null;
  $scope.clusterText = '';
  $scope.clusterTerm = '';
  $scope.events = null;
  $scope.selectedEvents = null;
  $scope.selectedEvent = null;
  $scope.filterText = null;

  $scope.eventSelected = function(evnt) {
    visualizeEvent(evnt);
  };

  $scope.eventChanged = function(evnt) {
    evnt.$save();
  };

  $scope.filterChanged = function() {
    let tempEvents = $scope.selectedEvents;
    $scope.selectedEvents = [];
    tempEvents.forEach(filterEvent);
  };

  function filterEvent(evnt){
    PostsCluster.find({
      filter: {
        where: {
          id: { inq: evnt.cluster_ids }
        }
      }
    })
    .$promise
    .then(clusters => $scope.filter(clusters, evnt))
    .catch(console.error);
  }

  function visualizeEvent(evnt) {
    $scope.selectedEvent = evnt;
    PostsCluster.find({
      filter: {
        where: {
          id: { inq: evnt.cluster_ids }
        }
      }
    })
    .$promise
    .then($scope.visualize)
    .then(visual => visual.forAll())
    .catch(console.error);
  }

  $scope.dateRangeSelected = function(start, end) {
    $scope.$apply(() => getEvents(start, end));
  };

  function getEvents(start, end) {
    let events = [];
    $scope.events.forEach(function(evnt) {
      if(evnt.end_time_ms >= start && evnt.end_time_ms <= end) {
        events.push(evnt);
      } else if(evnt.start_time_ms >= start && evnt.start_time_ms <= end) {
        events.push(evnt);
      } else if(evnt.start_time_ms <= start && evnt.end_time_ms >= end) {
        events.push(evnt);
      }
    });
    $scope.selectedEvents = events;
  }

  $scope.filter = filter;

  function filter(clusters, evnt) {
    let terms = evnt.hashtags.join(', ');

    if (terms.includes($scope.filterText)) {
      $scope.selectedEvents.push(evnt);
      return;
    }

    let similarPostIds = _(clusters).map('similar_post_ids')
      .flatten().compact().uniq().value();

    sampleSocialMediaPosts('text', similarPostIds)
    .then(posts => {
      let allText = posts.map(p => p.text).join(' ');
      if (allText.includes($scope.filterText)) {
        $scope.selectedEvents.push(evnt);
      }
    })
    .catch(console.error);
  }

  function sampleSocialMediaPosts(dataType, postIds, sampleSize=100) {
    $scope.showSpinner = true;

    postIds = _.sampleSize(postIds, sampleSize);

    return SocialMediaPost.find({
      filter: {
        where: {
          post_id: { inq: postIds },
          featurizer: dataType
        },
        fields: ['text', 'image_urls', 'hashtags', 'primary_image_url']
      }
    }).$promise
    .then(posts => {
      $scope.showSpinner = false;
      return posts;
    });
  }

  // 'visualize': show me the details
  $scope.visualize = visualize;

  function visualize(clusters) {
    let functions = {
      forText() {
        $scope.clusterText = '';

        let similarPostIds = _(clusters).map('similar_post_ids')
          .flatten().compact().uniq().value();

        sampleSocialMediaPosts('text', similarPostIds)
        .then(posts => {
          let allText = posts.map(p => p.text).join(' ');
          $scope.clusterText = allText;
        })
        .catch(console.error);
      },

      forMap() {
        let features = {};
        $scope.selectedEvent.location.forEach(location => {
          if (location.geo_type !== 'point')
            return;

          features[location.label] = {
            lat: location.coords[0].lat,
            lng: location.coords[0].lng,
            message: location.label,
            focus: true,
            draggable: false
          };
        });
        $scope.eventPoints = _.isEmpty(features) ? null : features;
      },

      forDomains() {
        $scope.clusterTerm = $scope.selectedEvent.domains.join(', ');
      },

      forHashtags() {
        $scope.clusterTerm = $scope.selectedEvent.hashtags.join(', ');
      },

      forImages() {
        $scope.imageUrls = $scope.selectedEvent.image_urls;
      },

      forAll() {
        this.forText();
        this.forMap();
        this.forHashtags();
        this.forImages();
      }
    };

    return functions;
  }
}



