'use strict';

angular.module('com.module.core')
.controller('EventsCtrl', EventsCtrl);

function EventsCtrl($scope, PostsCluster, SocialMediaPost, Event) {
  $scope.mapPoints = null;
  $scope.clusterText = '';
  $scope.events = null;
  $scope.selectedEvents = null;
  $scope.selectedEvent = null;
  $scope.filterText = null;

  $scope.eventSelected = function(evnt) {
    // already selected
    if ($scope.selectedEvent && $scope.selectedEvent.id === evnt.id)
      return;

    $scope.selectedEvent = evnt;

    visualizeEvent(evnt);
  };

  $scope.eventNamed = function(evnt) {
    Event.prototype$updateAttributes({
      id: evnt.id,
      name: evnt.name
    })
    .$promise
    .then(console.info)
    .catch(console.error);
  };

  $scope.ofInterestChanged = function(evnt) {
    Event.prototype$updateAttributes({
      id: evnt.id,
      of_interest: evnt.of_interest
    })
    .$promise
    .then(console.info)
    .catch(console.error);
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
    $scope.$apply(() => getEventsInRange(start, end));
  };

  function getEventsInRange(start, end) {
    $scope.selectedEvents = $scope.events.filter(evnt => {
      if (evnt.end_time_ms >= start && evnt.end_time_ms <= end) {
        return true;
      } else if (evnt.start_time_ms >= start && evnt.start_time_ms <= end) {
        return true;
      } else if (evnt.start_time_ms <= start && evnt.end_time_ms >= end) {
        return true;
      }
    });
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
      forMap() {
        let points = {};
        $scope.selectedEvent.location.forEach(location => {
          if (location.geo_type !== 'point')
            return;

          points[location.label] = {
            lat: location.coords[0].lat,
            lng: location.coords[0].lng,
            message: location.label,
            focus: true,
            draggable: false
          };
        });
        $scope.mapPoints = _.isEmpty(points) ? null : points;
      },

      forHashtags() {
        $scope.hashtags = $scope.selectedEvent.hashtags;
      },

      forImages() {
        $scope.imageUrls = $scope.selectedEvent.image_urls;
      },

      forKeywords() {
        $scope.keywords = $scope.selectedEvent.keywords;
      },

      forLocations() {
        $scope.locations = $scope.selectedEvent.location.map(loc => loc.label);
      },

      forAll() {
        this.forMap();
        this.forHashtags();
        this.forImages();
        this.forKeywords();
        this.forLocations();
      }
    };

    return functions;
  }
}
