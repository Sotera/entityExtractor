'use strict';

angular.module('com.module.core')
.directive('eventGraph', eventGraphDirective);

function eventGraphDirective() {
  return {
    controller: eventGraphController,
    link: link
  };

  function link(scope, elem, attrs, ctrls) {
    // run ctrl function immediately
    ctrls.create(null, angular.noop);
  }
}

function eventGraphController($scope, ClusterLink, AggregateCluster) {
  this.create = create;

  function create(event, callback) {
    createGraph(0,0,aggregateEvents)

  }

  function createGraph(start, end) {
    return ClusterLink.find()
      .$promise
      .then(getGraphData)
      .then(getEvents)
      .catch(console.error);
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

  function getEvents(graphData) {
    var nodes = graphData.nodes,
      edges = graphData.links,
      worker = new Worker('/js/workers/find-communities.js');

    worker.postMessage({nodes, edges});

    worker.onmessage = function(event) {
      switch (event.data.type) {
        // case "tick": return ticked(event.data);
        case 'end': return foundCommunities(event.data);
      }
    };

    function foundCommunities(data) {
      var communities = data.communities;
      var events = [];
      var finished = 0;
      var working = 0;
      communities.forEach(function(community){
        working++;
        createEvent(community,function(event){
          finished++;
          events.push(event);
          if(finished == working){
            $scope.events = events;
            aggregateEvents(events);
          }
        });
      });

    }

    function createEvent(community, callback){
      var event = {
        aggregate_clusters:[],
        start_time_ms:0,
        end_time_ms:0
      };
      var finished = 0;
      community.member_ids.forEach(function(id) {
        if(id.length === 24){
          event.aggregate_clusters.push(id);
          AggregateCluster.findOne({
            filter: {
              where: {
                id: id
              }
            }
          }).$promise
            .then(function(cluster) {
              if(event.start_time_ms===0){
                event.start_time_ms = cluster.start_time_ms;
                event.end_time_ms = cluster.end_time_ms;
              }
              if(event.start_time_ms>cluster.start_time_ms){
                event.start_time_ms = cluster.start_time_ms;
              }
              if(event.end_time_ms<cluster.end_time_ms){
                event.end_time_ms = cluster.end_time_ms;
              }
            })
            .then(function(){
              finished++;
              if(finished == event.aggregate_clusters.length){
                callback(event);
              }
            })
            .catch(console.error);
        }
      });
    }
  }

  function aggregateEvents(events){
    var minDate,maxDate;
    var minCount = 0, maxCount = 0;
    var data = [];
    var dataMap = {};
    var finishedCount = 0;
    events.forEach(function(event) {
      finishedCount++;

      if (!minDate) {
        minDate = event.end_time_ms;
        maxDate = event.end_time_ms;
      }
      minDate = event.end_time_ms < minDate ? event.end_time_ms : minDate;
      maxDate = event.end_time_ms > maxDate ? event.end_time_ms : maxDate;

      var aggregate = dataMap[event.end_time_ms];
      if(!aggregate){
        aggregate = {
          count: 0,
          date: new Date(event.end_time_ms)
        };
        data.push(aggregate);
        dataMap[event.end_time_ms] = aggregate;
      }
      aggregate.count++;

      if (finishedCount == events.length){
        data.sort(function(a,b){
          if (a.date < b.date) {
            return -1;
          }
          if (a.date > b.date) {
            return 1;
          }
          // a must be equal to b
          return 0;
        });
        data.forEach(function(point) {
          minCount = point.count < minCount ? point.count : minCount;
          maxCount = point.count > maxCount ? point.count : maxCount;
        });
        graphEventCounts(data, new Date(minDate), new Date(maxDate), minCount, maxCount);
      }
    });
  }

  function graphEventCounts(data, minDate, maxDate, yMin, yMax) {
    var margin = {top: 30, right: 0, bottom: 20, left: 50};

    var $container = $('.nav-chart-container'),
      width = $container.width(),
      height = $container.height();

    var navWidth = width - margin.left - margin.right,
      navHeight = height - margin.top - margin.bottom;

    var parseTime = d3.timeFormat('%I:%M %p');

    var tooltip = d3.tip()
      .attr('class', 'd3-tip')
      .offset([-20, 20])
      .html(function(d) {
        return d.count + ' at ' + parseTime(d.date);
      });

    var navChart = d3.select('.nav-chart-container')
      .classed('chart', true).append('svg')
      .classed('navigator', true)
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', 'translate(' + [margin.left, margin.top] + ')')
      .call(tooltip);

    var xScale = d3.scaleTime()
        .domain([minDate, maxDate])
        .range([0, navWidth]);

    var yScale = d3.scaleLinear()
        .domain([yMin, yMax])
        .range([navHeight, 0]);

    var navArea = d3.area()
      .x(function(d) {
        return xScale(d.date);
      })
      .y0(navHeight)
      .y1(function(d) {
        return yScale(d.count);
      });

    var navLine = d3.line()
      .x(function(d) {
        return xScale(d.date);
      })
      .y(function(d) {
        return yScale(d.count);
      });

    navChart.append('path')
      .attr('class', 'data')
      .attr('d', navArea(data));

    navChart.append('path')
      .attr('class', 'line')
      .attr('d', navLine(data));

    var viewport = d3.brushX()
      .on('end', function () {
        redrawChart();
      });

    var xAxis = d3.axisBottom(xScale);

    navChart.append('g')
      .attr('class', 'x axis')
      .attr('transform', 'translate(0,' + navHeight + ')')
      .call(xAxis);

    var yAxis = d3.axisLeft(yScale);

    navChart.append('g')
      .attr('class', 'y axis')
      .call(yAxis)
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 6)
      .attr('dy', '.71em')
      .style('text-anchor', 'end')
      .text('linkages');

    function redrawChart() {
      if(!d3.event.selection){
        $scope.dateRangeSelected(0,0);
        return;
      }
      var start = xScale.invert( d3.event.selection[0] );
      var end = xScale.invert( d3.event.selection[1] );
      $scope.dateRangeSelected(start.getTime(), end.getTime());
    }

    navChart.append('g')
      .attr('class', 'viewport')
      .call(viewport)
      .selectAll('rect')
      .attr('height', navHeight);

    // add tooltips
    navChart.selectAll('circle')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'circle')
      .attr('cx', function(d) {
        return xScale(d.date);
      })
      .attr('cy', function(d) {
        return yScale(d.count);
      })
      .attr('r', 4)
      .on('mouseover', tooltip.show)
      .on('mouseout', tooltip.hide)
  }

}
