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
    ctrls.create();
  }
}

function eventGraphController($scope, Event, EventNetwork) {
  // models primarily controlled by directive
  $scope.events = null;
  $scope.selectedDates = [0,0];
  $scope.selectedEvents = null;

  this.create = createGraph;

  $scope.getEventsInRange = function(start, end) {
    // use cached value if none given
    start = start || $scope.selectedDates[0];
    end = end || $scope.selectedDates[1];
    $scope.selectedEvents = _($scope.events).filter(evnt => {
      if ((evnt.end_time_ms >= start && evnt.end_time_ms <= end) ||
        (evnt.start_time_ms >= start && evnt.start_time_ms <= end) ||
        (evnt.start_time_ms <= start && evnt.end_time_ms >= end)) {
        return true;
      }
    }).orderBy('start_time_ms').value();

    decorateSelectedEvents();
  };

  // issue 'side' queries, to decorate events with additional attributes.
  // an alternative to creating many one-off event-related network calls.
  function decorateSelectedEvents(callback) {
    $scope.showSpinner = true
    let eventIds = _.map($scope.selectedEvents, 'id');
    EventNetwork.find({
      filter: {
        where: {
          event_id: { inq: eventIds }
        },
        fields: ['event_id']
      }
    })
    .$promise
    .then(networks => {
      networks.forEach(n => {
        // match with selected event
        _.find($scope.selectedEvents, e => e.id == n.event_id).has_user_network = 1;
      })
    })
    .then(() => $scope.showSpinner = false)
    .catch(console.error)
  }

  //we probably want to bound this in some way
  function createGraph() {
    $scope.showSpinner = true;
    return Event.find()
      .$promise
      .then(events => $scope.events = events)
      .then(aggregateEvents)
      .then(() => $scope.showSpinner = false)
      .catch(console.error);
  }

  function aggregateEvents(events){
    if (!events.length) {
      return;
    }

    var minDate,maxDate;
    var minCount = 0, maxCount = 0;
    var data = [];
    var dataMap = {};
    var finishedCount = 0;

    events.forEach(function(event) {
      finishedCount++;

      if (!minDate) {
        minDate = event.start_time_ms;
        maxDate = event.start_time_ms;
      }
      minDate = event.start_time_ms < minDate ? event.start_time_ms : minDate;
      maxDate = event.start_time_ms > maxDate ? event.start_time_ms : maxDate;

      var aggregate = dataMap[event.start_time_ms];
      if(!aggregate){
        aggregate = {
          count: 0,
          date: new Date(event.start_time_ms)
        };
        data.push(aggregate);
        dataMap[event.start_time_ms] = aggregate;
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
        $scope.$apply(() => selectEvents());
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

    function selectEvents() {
      var selection = d3.event.selection;
      if (!selection) {
        return;
      }
      var start = xScale.invert( selection[0] ).getTime();
      var end = xScale.invert( selection[1] ).getTime();
      // cache dates for later use.
      // TODO: better way to get selected values from chart?
      $scope.selectedDates = [start, end];
      $scope.getEventsInRange(start, end);
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
      .on('mouseout', tooltip.hide);
  }

}
