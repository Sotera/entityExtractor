'use strict';

angular.module('com.module.core')
.controller('EventsCtrl', EventsCtrl);

function EventsCtrl($scope, PostsCluster, SocialMediaPost, Event, $window, authorProfileURLFilter) {
  $scope.mapPoints = null;
  $scope.selectedEvent = null;
  $scope.filterText = null;
  $scope.authorPosts = null;
  $scope.retweetCounts = [];
  $scope.selectedImageUrl = null;

  $scope.eventSelected = function(evnt) {
    // already selected
    if ($scope.selectedEvent && $scope.selectedEvent.id === evnt.id)
      return;

    $scope.selectedEvent = evnt;

    visualizeEvent(evnt);

    console.info(`${$window.location.origin}/api/charts/twitter/user-network?eventid=${evnt.id}`);
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

  $scope.loadAuthorUrl = function(post) {
    $scope.showSpinner = true;

    if (post.screen_name)
      $window.open(authorProfileURLFilter(post));

    return $scope.loadAuthorPosts(post.screen_name);
  };

  $scope.loadAuthorPosts = function(screen_name) {
    return SocialMediaPost.find({
      filter: {
        where: {
          screen_name: screen_name,
          featurizer: 'text'
        },
        order: 'timestamp_ms desc',
        fields: ['text', 'screen_name', 'post_url', 'author_image_url',
        'timestamp_ms']
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
      let authors = posts.map(p => p.screen_name).join(' ');
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
        fields: ['text', 'image_urls', 'hashtags', 'primary_image_url',
          'screen_name', 'post_url', 'author_image_url', 'quote_post_id',
          'broadcast_post_id', 'reply_to_post_id']
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
      forUserNetwork(){
        $scope.loadUserNetworkGraph($scope.selectedEvent.id);
      },
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
          $scope.posts = _(posts).orderBy(p => p.screen_name.toLowerCase()).value();
          createPostsCharts(posts);
        });
      },

      forAll() {
        this.forUserNetwork();
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

    // use 'image' posts to get primary_image_url attr for ui convenience.
    return sampleSocialMediaPosts('image', similarPostIds, 200)
    .catch(console.error);
  }

  function createPostsCharts(posts) {
    let counts = posts.reduce((acc, curr) => {
      // broadcast wins if also a quote
      if (curr.broadcast_post_id)
        acc['broadcast']++
      else if (curr.quote_post_id)
        acc['quote']++
      else if (curr.reply_to_post_id)
        acc['reply']++
      else
        acc['direct']++

      return acc;
    }, {quote: 0, broadcast: 0, reply: 0, direct: 0});

    $scope.postTypeCounts = [
      {label: 'quote', value: counts['quote']},
      {label: 'retweet', value: counts['broadcast']},
      {label: 'reply', value: counts['reply']},
      {label: 'direct', value: counts['direct']}
    ];
    $scope.postTypeConf = [
      {path: 'header.title.text', value: 'post types'}
    ];
  }
}
