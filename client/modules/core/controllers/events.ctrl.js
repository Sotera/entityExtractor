angular.module('com.module.core')
  .controller('EventsCtrl', EventsCtrl);

function EventsCtrl($scope, AggregateCluster, Extract, Geocoder, SocialMediaPost, $q) {
  $scope.eventPoints = {};
  $scope.clusterText = '';
  $scope.clusterTerm = '';
  $scope.events = null;
  $scope.selectedEvents = null;
  // obj: represents a cluster but not a loopback model

  $scope.eventSelected = function(evnt){
    visualizeEvent(evnt);
  };

  function visualizeEvent(evnt) {
    AggregateCluster.find({
      filter: {
        where: {
          id: { inq: evnt.aggregate_clusters }
        }
      }
    }).$promise
      .then(clusters => {
        $scope.communityClusters = clusters;
        return clusters;
      })
      .then($scope.visualize)
      .then(visual => visual.forAll())
      .catch(console.error);
  }

  $scope.dateRangeSelected = function(start, end) {
    $scope.showSpinner = true;
    $q.all([
      getEvents(start,end)
    ])
    .then(function() {
      $scope.showSpinner = false;
    })
    .catch(console.error);
  };

  function getEvents(start, end){
    var events = [];
    $scope.events.forEach(function(aggEvent){
      if(aggEvent.end_time_ms >= start && aggEvent.end_time_ms<=end){
        events.push(aggEvent);
      }
    });
    $scope.selectedEvents = events;
  }



   // 'visualize': show me the details
  $scope.visualize = visualize;

  function getWords(words) {


    words = words.replace(/#\S+/g, ' ');
    words = words.replace(/@\S+/g, ' ');
    words = words.replace(/\s+/g,' ').trim();

    return words.replace(/[!\.,:;\?]/g, ' ');

  }

  function visualize(clusters) {
    if (!_.isArray(clusters)) clusters = [clusters];

    function sampleSocialMediaPosts(dataType, sampleSize=100) {
      let similarPostIds = _(clusters).map('similar_post_ids')
        .flatten().compact().uniq().value();

      let ids = _.sampleSize(similarPostIds, sampleSize);

      return SocialMediaPost.find({
        filter: {
          where: {
            post_id: { inq: ids },
            featurizer: dataType
          }
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

      forMap(){
        sampleSocialMediaPosts('text')
          .then(posts => {
            return posts.map(p => p.text).join(' ');

          })
          .then(text=>{
            var blob = getWords(text);
            Extract.entities({"text": blob,
              "mime_type": "text/html",
              "extract_type": "mitie"})
              .$promise
              .then(entities=>{
                return entities.filter(function(entity){ return entity.label.length >2&&entity.tag==="LOCATION"&&entity.score>=.7});
              })
              .then(locations=>{
                let finished = 0;
                let features = {};
                if(locations.length ==0){
                  $scope.eventPoints = features;
                  return;
                }
                locations.forEach(function(location){
                  Geocoder.forwardGeo({"address": location.label})
                    .$promise
                    .then(geo=>{
                      finished++;
                      if(geo.length > 0) {
                        features[location.label] = { lat: geo[0].latitude, lng: geo[0].longitude, message: location.label, focus: true, draggable: false };
                      }
                      if(finished === locations.length){
                        $scope.eventPoints = features;
                      }
                    });

                });
              });
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
        this.forText();
        this.forMap();
        this.forHashtags();
        this.forImages();
      }
    };

    return functions;
  }
}



