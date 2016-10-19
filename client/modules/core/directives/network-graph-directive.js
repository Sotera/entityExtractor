'use strict';

angular.module('com.module.core')
.directive('networkGraph', networkGraphDirective);

function networkGraphDirective() {
  return {
    controller: networkGraphController
  };
}

function networkGraphController($scope, ClusterLink) {
  var colors = {
    hashtag: 'Goldenrod',
    text: 'SteelBlue',
    image: 'Maroon'
  };

  this.create = createGraph;

  function createGraph(event, start, end, callback) {
    var query = {
      filter: {
        where: {
          end_time_ms: { between: [start, end] }
        }
      }
    };
    return ClusterLink.find(query)
      .$promise
      .then(getGraphData)
      .then(graphClusterLinks)
      .then(callback || angular.noop)
      .catch(console.error);
  }

  $scope.loadNetworkGraph = function(start, end, callback) {
    if ($scope.networkGraphSvg)
      $scope.networkGraphSvg.remove();

    return createGraph(null, start, end, callback);
  };

  function getGraphData(links){
    var graph = {};
    graph.links = links;
    graph.nodes = [];
    graph.links.forEach(function(link){
      link.value = link.weight;
      graph.nodes.push({
        id: link.source, group: link.source_data_type
      });
      graph.nodes.push({
        id: link.target, group: link.target_data_type
      });
    });

    graph.nodes = _.uniqWith(graph.nodes, _.isEqual);

    return graph;
  }

  function graphClusterLinks(graphData) {
    var $container = $('.chart-container'),
      width = $container.width(),
      height = $container.height(),
      svg = d3.select('.chart-container').append('svg'),
      minDim = Math.min(width, height);

    $scope.networkGraphSvg = svg;

    svg.attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', [0, 0, minDim, minDim])
      .attr('preserveAspectRatio','xMinYMin');

    svg.call(addTitle, width);

    var zoom = d3.zoom()
      .scaleExtent([-40, 40])
      .on('zoom', zoomed);

    svg.call(zoom);

    function zoomed() {
      node.attr('transform', d3.event.transform);
      link.attr('transform', d3.event.transform);
    }

    var simulation = d3.forceSimulation()
      .force('link', d3.forceLink().id(function(d) { return d.id; }))
      .force('charge', d3.forceManyBody())
      .force('center', d3.forceCenter(width / 2, height / 2));

    var link = svg.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(graphData.links)
      .enter().append('line')
      .attr('stroke-width', function(d) {
        return Math.sqrt(d.value);
      });

    var node = svg.append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(graphData.nodes)
      .enter().append('circle')
      .attr('r', 8)
      .attr('fill', function(d) {
        return colors[d.group];
      })
      .on('click', function(d) {
        simulation.stop();
        $scope.visualizeCluster(d);
      })
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    node.append('title')
      .text(function (d) {
        return d.group;
      });

    simulation
      .nodes(graphData.nodes)
      .on('tick', ticked);

    simulation.force('link')
      .links(graphData.links);

    function ticked() {
      link
        .attr('x1', function(d) {
          return d.source.x;
        })
        .attr('y1', function(d) {
          return d.source.y;
        })
        .attr('x2', function(d) {
          return d.target.x;
        })
        .attr('y2', function(d) {
          return d.target.y;
        });

      node
        .attr('cx', function(d) {
          return d.x;
        })
        .attr('cy', function(d) {
          return d.y;
        });
    }

    function dragstarted(d) {
      if (!d3.event.active)
        simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(d) {
      d.fx = d3.event.x;
      d.fy = d3.event.y;
    }

    function dragended(d) {
      if (!d3.event.active)
        simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // handle key events to manually control force
    d3.select('body').on('keydown', function simulationControlHandler() {
      console.log('keydown ::', d3.event.keyCode);

      switch(d3.event.keyCode) {
        case 88: // x
          simulation.stop();
          break;
        case 90: // z
          simulation.restart();
          break;
      }
    });
  }
}

function addTitle(selection, width) {
  selection.append('text')
    .attr('x', (width / 2))
    .attr('y', 20)
    .attr('text-anchor', 'middle')
    .style('font-size', '20px')
    .text('Clusters');
}
