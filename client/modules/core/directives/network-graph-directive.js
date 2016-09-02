'use strict';
angular.module('com.module.core')
  .directive('networkGraph', [
    function() {
      return {
        link: link,
        controller: ['$scope', 'ClusterLink','PostsCluster',
          function($scope, ClusterLink, PostsCluster) {
            this.create = create;
            function create(event, callback) {
              /*var query = {
                  where: { "start_time_ms": {"between": [Date.now()-3600000,Date.now()]} }
              };*/
              ClusterLink.find(/*query*/)
                .$promise
                .then(graphEvents)
                .then(callback || angular.noop)
                .catch(console.error);
            }

            function graphEvents(links) {
              var graph = {};
              graph.links = links;
              graph.nodes=[];
              var nodeSet = new Set();
              graph.links.forEach(function(link){
                link.value = link.weight;
                nodeSet.add(link.source);
                nodeSet.add(link.target);
              });

              nodeSet.forEach(function(node){
                graph.nodes.push({"id":node});
              });

              var svg = d3.select("svg"),
                width = +svg.attr("width"),
                height = +svg.attr("height");

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
                  return color(d.group);
                })
                .call(d3.drag()
                  .on("start", dragstarted)
                  .on("drag", dragged)
                  .on("end", dragended));

              node.append("title")
                .text(function (d) {
                  return d.id;
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
        ctrls.create(null,function(){});
      }

    }]);
