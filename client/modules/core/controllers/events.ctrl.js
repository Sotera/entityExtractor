'use strict';

angular.module('com.module.core')
.controller('EventsCtrl', EventsCtrl);

function EventsCtrl($scope, PostsCluster, SocialMediaPost, Event, $window, authorProfileURLFilter) {
  $scope.mapPoints = null;
  $scope.selectedEvent = null;
  $scope.filterText = null;
  $scope.authorPosts = null;

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
    // rm previously selected event
    $scope.selectedEvent = null;

    // reset events
    $scope.getEventsInRange();

    // apply filter
    let tmpEvents = $scope.selectedEvents;
    $scope.selectedEvents = [];
    tmpEvents.forEach(filterEvent);
  };

  $scope.loadAuthorPosts = function(post) {
    $scope.showSpinner = true;

    if (post.author_id)
      $window.open(authorProfileURLFilter(post));

    return SocialMediaPost.find({
      filter: {
        where: {
          author_id: post.author_id,
          featurizer: 'text'
        },
        order: 'timestamp_ms desc',
        fields: ['text', 'author_id', 'post_url', 'author_image_url', 'timestamp_ms']
      }
    })
    .$promise
    .then(posts => {
      $scope.authorPosts = posts;
      $scope.showSpinner = false;
    })
    .catch(console.error);
  };

  function filterEvent(evnt) {
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

  $scope.filter = filter;

  function filter(clusters, evnt) {
    let regex = new RegExp($scope.filterText, 'i'),
      terms = evnt.hashtags.join(', ');

    if (regex.test(terms)) {
      $scope.selectedEvents.push(evnt);
      return;
    }

    let similarPostIds = _(clusters).map('similar_post_ids')
      .flatten().compact().uniq().value();

    sampleSocialMediaPosts('text', similarPostIds, 250)
    .then(posts => {
      let allText = posts.map(p => p.text).join(' ');
      if (regex.test(allText)) {
        $scope.selectedEvents.push(evnt);
      }
      let authors = posts.map(p => p.author_id).join(' ');
      if (regex.test(authors)) {
        $scope.selectedEvents.push(evnt);
      }
    })
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
    .then(visualize)
    .then(visuals => visuals.forAll())
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
        fields: ['text', 'image_urls', 'hashtags', 'primary_image_url', 'author_id',
          'post_url', 'author_image_url']
      }
    })
    .$promise
    .then(posts => {
      $scope.showSpinner = false;
      return posts;
    });
  }

  function visualize(clusters) {
    let functions = {
      forMap() {
        let points = {};
        $scope.selectedEvent.location.forEach(location => {
          if (location.geo_type !== 'point')
            return;

          if (_.isEmpty(location.label))
            return;

          // country weight is .05
          if (location.weight < 0.05)
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
        $scope.locations = _.orderBy($scope.selectedEvent.location, 'weight', 'desc');
      },

      forPosts() {
        getPosts(clusters)
        .then(posts => {
          $scope.posts = _(posts).orderBy(p => p.author_id.toLowerCase()).value();
        });
      },

      forAll() {
        this.forMap();
        this.forHashtags();
        this.forImages();
        this.forKeywords();
        this.forLocations();
        this.forPosts();
      }
    };

    return functions;
  }

  function getPosts(clusters) {
    let similarPostIds = _(clusters).map('similar_post_ids')
      .flatten().compact().uniq().value();

    return sampleSocialMediaPosts('text', similarPostIds, 200)
    .catch(console.error);
  }
}
