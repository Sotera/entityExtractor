'use strict';

angular.module('com.module.core')
.directive('communitiesGraph', communitiesDirective);

function communitiesDirective() {
  return {
    controller: communitiesGraphController,
    // link: link
  };

  // function link(scope, elem, attrs, ctrls) {
  //   ctrls.createGraph(null, angular.noop);
  // }
}

function communitiesGraphController($scope, ClusterLink, AggregateCluster) {
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
      .then(graphCommunities)
      .then(callback || angular.noop)
      .catch(console.error);
  }

  $scope.loadCommunityGraph = function(start, end, callback) {
    if ($scope.communityGraphSvg)
      $scope.communityGraphSvg.remove();

    return createGraph(null, start, end, callback);
  };

  function graphCommunities(graphData) {
    var nodes = graphData.nodes,
      edges = graphData.links,
      $container = $('.communities-container'),
      width = $container.width(),
      height = $container.height(),
      color = d3.scaleOrdinal().range(d3.schemeCategory20),
      minDim = Math.min(width, height),
      worker = new Worker('/js/workers/find-communities.js');

    var svg = d3.select('.communities-container').append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', [0, 0, minDim, minDim])
      .attr('preserveAspectRatio','xMinYMin')

    svg.call(addTitle, width);

    $scope.communityGraphSvg = svg;

    worker.postMessage({nodes, edges, width, height });

    worker.onmessage = function(event) {
      switch (event.data.type) {
        // case "tick": return ticked(event.data);
        case 'end': return foundCommunities(event.data);
      }
    };

    // function ticked(data) {
    //   var progress = data.progress;
    // }

    function foundCommunities(data) {
      var communities = data.communities;

      var node = svg.selectAll('circle')
        .data(communities)
        .enter()
        .append('circle')
        .call(createCircles, color);

      var zoom = d3.zoom()
        .scaleExtent([-40, 40])
        .on('zoom', zoomed);

      svg.call(zoom);

      function zoomed() {
        node.attr('transform', d3.event.transform);
      }
    }
  }

  function addTitle(selection, width) {
    selection.append('text')
      .attr('x', (width / 2))
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .style('font-size', '20px')
      .text('Communities');
  }

  function createCircles(selection, colorize) {
    selection
      .attr('class', 'circle')
      .attr('fill', '#fff')
      .attr('stroke', function(d, i) { return colorize(i); })
      .attr('stroke-width', 8)
      .attr('cx', function(d) { return d.x; })
      .attr('cy', function(d) { return d.y; })
      .attr('r', function(d) {
        var min = 5, len = d.member_ids.length;
        return len < min ? min : len;
      })
      .on('click', function(d) {
        var clusterIds = d.member_ids;
        visualizeAllClusters(clusterIds);
        highlightNetworkClusters(clusterIds, d3.select(this).attr('stroke'));
      });
  }

  function highlightNetworkClusters(clusterIds, color) {
    var networkGraph = $scope.networkGraphSvg;
    if (networkGraph) {
      networkGraph.selectAll('.nodes circle')
        .filter(function(d) {
          return _.includes(clusterIds, d.id);
        })
        .style('stroke-width', 6)
        .style('stroke', color || 'black');
    }
  }

  function visualizeAllClusters(clusterIds) {
    AggregateCluster.find({
      filter: {
        where: {
          id: { inq: clusterIds }
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
}

function getGraphData(links) {
  // jLouvain lib expects nodes like ['a', 'b'] and
  // edges like [{source: 'a', target: 'b'}]
  var graph = {};
  graph.links = links;
  graph.nodes = [];
  graph.links.forEach(function(link){
    graph.nodes.push(link.source);
    graph.nodes.push(link.target);
  });

  graph.nodes = _.uniq(graph.nodes);

  return graph;
}
