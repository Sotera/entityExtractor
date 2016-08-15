angular.module('com.module.core')
  .controller('ParserCtrl',['$scope','$http','ParsedEvent','TextFeed',
    function($scope, $http, ParsedEvent, TextFeed) {

    var osm = 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      arcgis = 'http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

    angular.extend($scope, {
      center: {
        zoom: 2,
        lng: 7.9,
        lat: 1.0
      },
      tiles: {
        url: arcgis
      },
      myModel: {
        dataString: 'North Korea leader Kim Jong Un ordered his country \
to be ready to use its nuclear weapons at any time'
      }
    });

    $scope.$watch('center.zoom', function(zoom) {
      $scope.tiles.url = (zoom > 3) ? osm : arcgis;
    });

    $scope.submit = function(){
      $http.post('/api/extract/process', $scope.myModel)
      .success(function(data, status) {
        console.log(data);
      })
    };

    $scope.destroyData = function() {
      ParsedEvent.destroyData()
      .$promise
      .then(function(data) {
        console.log(data);
        resetMarkers();
      })
      .catch(console.error);
    }

    function addEvents(events) {
      events.map(addEvent);
    };

    function addEvent(event) {
      $scope.markers[event.id] = event;
    };

    function resetMarkers() {
      angular.extend($scope, {
        markers: {}
      });
    };

    resetMarkers();

    (function watchChanges() {
      var parsedEventsUrl = '/api/parsedEvents/change-stream?_format=event-stream';
      var src = new EventSource(parsedEventsUrl);
      src.addEventListener('data', function(msg) {
        var data = JSON.parse(msg.data);
        if (!data.geocoded || data.type !== 'create') return; // only on create
        var event = data.data;
      	$scope.$apply(function() {
          addEvent(event);
        });
      });
      src.onerror = console.error;
    })();

    (function getExistingEvents() {
      var filter = {
        filter: {
          where: {
            geocoded: true
          }
        }
      };
      ParsedEvent.find(filter)
      .$promise
      .then(function(parsedEvents){
        if(!parsedEvents.length) {
          return;
        }
        addEvents(_.invokeMap(parsedEvents, 'toJSON'));
      })
      .catch(console.error);
    })();

  }]);


    // dump the sections if we want to filter below
    // $http.get('http://api.nytimes.com/svc/news/v3/content/section-list?api-key=238cd8a60d87d3b49ce118ef1d94850c:8:74624285')
    // .then(console.log);

    // TODO: get more pages once we stop killing the server
    // for (var i=0; i<=1; i++) {
    //   $http.get('http://api.nytimes.com/svc/news/v3/content/all/all/48?offset=' + i*20 +
    //     '&api-key=238cd8a60d87d3b49ce118ef1d94850c:8:74624285')
    //   .then(function(data) {
    //     console.log(data);
    //     var submissions = [];
    //     var results = data.data.results;
    //     results.forEach(function(res) {
    //       if ( res.material_type_facet == 'News' ) {
    //         // var news = {
    //         //   title: res.title,
    //         //   time: res.created_date,
    //         //   locations: geo_facet.join('|'),
    //         // };
    //         var news = [res.abstract, res.title, res.created_date, res.geo_facet.toString()].join('|');
    //         console.log(news);
    //         submissions.push(news);
    //       }
    //     });

    //     submissions.forEach(function(sub) {
    //       $http.post("/api/extract/process", {dataString: sub})
    //       .then(function(data, status) {
    //         console.log(data);
    //       })
    //       .catch(console.error);
    //     });
    //   })
    //   .catch(console.error);
    // }
