'use strict';
angular.module('com.module.core')
  .directive('networkGraph', [
    function() {
      return {
        link: link,
        controller: ['$scope', 'ClusterLink','PostsCluster',
          function($scope, ClusterLink, PostsCluster) {

            this.create = create;
            function create(event, start, end, callback) {
              var query = {
                filter: {
                  where: { "end_time_ms": {"between": [start,end]} }
                }
              };
              ClusterLink.find(query)
                .$promise
                .then(graphEvents)
                .then(callback || angular.noop)
                .catch(console.error);
            }

            $scope.loadNetworkGraph = function(start, end) {
              if($scope.graphSvg)
                $scope.graphSvg.remove();
              create(null,start, end, function(){});
            };

            var colors = {
              "hashtag":"Goldenrod",
              "text":"SteelBlue",
              "image":"Maroon"
            };
            function getNetworkGraph(links){
              var graph = {};
              graph.links = links;
              graph.nodes=[];
              graph.links.forEach(function(link){
                link.value = link.weight;
                graph.nodes.push({"id":link.source, "group":link.source_data_type});
                graph.nodes.push({"id":link.target, "group":link.target_data_type});
              });

              graph.nodes = _.uniqWith(graph.nodes, _.isEqual);

              return graph;
            }

            function graphEvents(links) {
              var $container = $('.chart-container'),
                width = $container.width(),
                height = $container.height(),
                graph = getNetworkGraph(links),
                svg = d3.select('.chart-container').append("svg");

              $scope.graphSvg = svg;

              svg.attr("width", '100%')
                .attr("height", '100%')
                .attr('viewBox','0 0 '+Math.min(width,height) +' '+Math.min(width,height) )
                .attr('preserveAspectRatio','xMinYMin')
                .append("g")
                .attr("transform", "translate(" + Math.min(width,height) / 2 + "," + Math.min(width,height) / 2 + ")");

              var color = d3.scaleOrdinal(d3.schemeCategory20);

              var zoom = d3.zoom()
                .scaleExtent([-40, 40])
                .on("zoom", zoomed);

              var simulation = d3.forceSimulation()
                .force("link", d3.forceLink().id(function(d) { return d.id; }))
                .force("charge", d3.forceManyBody())
                .force("center", d3.forceCenter(width / 2, height / 2));

              var link = svg.append("g")
                .attr("class", "links")
                .selectAll("line")
                .data(graph.links)
                .enter().append("line")
                .attr("stroke-width", function (d) {
                  return Math.sqrt(d.value);
                });

              var node = svg.append("g")
                .attr("class", "nodes")
                .selectAll("circle")
                .data(graph.nodes)
                .enter().append("circle")
                .attr("r", 5)
                .attr("fill", function (d) {
                  return colors[d.group];
                })
                .on("click",function(d){
                  $scope.showDetails(d);
                })
                .call(d3.drag()
                  .on("start", dragstarted)
                  .on("drag", dragged)
                  .on("end", dragended));

              node.append("title")
                .text(function (d) {
                  return d.group;
                });

              svg.call(zoom);

              function zoomed() {
                node.attr("transform", d3.event.transform);
                link.attr("transform", d3.event.transform);
              }

              simulation
                .nodes(graph.nodes)
                .on("tick", ticked);

              simulation.force("link")
                .links(graph.links);


              function ticked() {
                link
                  .attr("x1", function (d) {
                    return d.source.x;
                  })
                  .attr("y1", function (d) {
                    return d.source.y;
                  })
                  .attr("x2", function (d) {
                    return d.target.x;
                  })
                  .attr("y2", function (d) {
                    return d.target.y;
                  });

                node
                  .attr("cx", function (d) {
                    return d.x;
                  })
                  .attr("cy", function (d) {
                    return d.y;
                  });
              }

              function dragstarted(d) {
                if (!d3.event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
              }

              function dragged(d) {
                d.fx = d3.event.x;
                d.fy = d3.event.y;
              }

              function dragended(d) {
                if (!d3.event.active) simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
              }

            }


          }]
      };

      function link(scope, elem, attrs, ctrls) {

      }

    }]);
