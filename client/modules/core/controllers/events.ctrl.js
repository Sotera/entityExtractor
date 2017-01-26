'use strict';

angular.module('com.module.core')
.controller('EventsCtrl', EventsCtrl);

function EventsCtrl($scope, PostsCluster, SocialMediaPost, Event) {
  $scope.eventPoints = null;
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

  $scope.filterChanged = function() {
    let tempEvents = $scope.selectedEvents;
    $scope.selectedEvents = [];
    tempEvents.forEach(filterEvent);
  };

  function filterEvent(evnt) {
    let hashtags = evnt.hashtags.join(', ');
    let keywords = evnt.keywords.map(k => k[0]);

    if (hashtags.includes($scope.filterText)) {
      return $scope.selectedEvents.push(evnt);
    }

    if (keywords.includes($scope.filterText)) {
      return $scope.selectedEvents.push(evnt);
    }
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

  // 'visualize': show me the details
  $scope.visualize = visualize;

  function visualize(clusters) {
    let functions = {
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

      forHashtags() {
        $scope.eventHashtags = $scope.selectedEvent.hashtags.join(', ');
      },

      forImages() {
        $scope.eventImageUrls = $scope.selectedEvent.image_urls;
      },

      forKeywords() {
        $scope.eventKeywords = $scope.selectedEvent.keywords;
      },

      forAll() {
        this.forMap();
        this.forHashtags();
        this.forImages();
        this.forKeywords();
      }
    };

    return functions;
  }
}
