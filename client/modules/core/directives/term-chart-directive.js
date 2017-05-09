'use strict';

angular.module('com.module.core')
.directive('termChart', termChartDirective);

function termChartDirective() {
  return {
    controller: termChartController,
    link: link
  };

  function link(scope, elem, attrs, ctrls) {

    scope.$watch('interval', function() {
      ctrls.create();
    });

    scope.$watch('windowCount', function() {
      ctrls.create();
    });

    scope.$watchCollection('terms', function() {
      ctrls.create();
    });

    scope.$watch('maxDate', function() {
      ctrls.create();
    });

  }
}

function termChartController($scope, SocialMediaPost) {
  this.create = create;

  function create() {
    let minute = 60 * 1000;
    let intervalSize = $scope.interval * minute;
    let maxDate = $scope.maxDate.getTime();
    let queryTime = maxDate;

    let minDate = maxDate - $scope.windowCount*intervalSize;
    let maxY = 0;
    let windows = [];

    for(let i=0; i<$scope.windowCount; i++){
      windows.push({startTime:queryTime-intervalSize,endTime:queryTime});
      queryTime-=intervalSize;
    }

    Promise.all($scope.terms.map(term =>{
      return Promise.all(windows.map(window=>{
        return SocialMediaPost.count({
           where: {
              lang:'en',
              featurizer: 'text',
              text:{like:term},
              timestamp_ms:{between:[window.startTime,window.endTime]}
           }
        }).$promise.then(results => {
          if(results.count > maxY)maxY = results.count;
          return {count:results.count, term:term, window:window};
        })
      })).then(results=>{
        return results;
      })
    })).then(results=>{
      console.log(results);
      graphTermCounts(_(results).orderBy('start_time_ms').value(), minDate+intervalSize, maxDate, 0, maxY);
    });


  }

  function graphTermCounts(data, minDate, maxDate, yMin, yMax) {

    const margin = {top: 30, right: 0, bottom: 20, left: 50};

    const $container = $('.term-chart-container'),
      width = $container.width(),
      height = $container.height();

    $('.term-chart-container').empty();

    const navWidth = width - margin.left - margin.right,
      navHeight = height - margin.top - margin.bottom;

    const parseTime = d3.timeFormat('%I:%M %p');

    const tooltip = d3.tip()
      .attr('class', 'd3-tip')
      .offset([-20, 20])
      .html(function (d) {
        return d.term + " " + d.count + ' at ' + parseTime(d.window.endTime);
      });

    const navChart = d3.select('.term-chart-container')
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


    var navLine = d3.line()
      .x(function(d) {
        return xScale(d.window.endTime);
      })
      .y(function(d) {
        return yScale(d.count);
      });

    data.forEach(single => {
      navChart.append('path')
        .attr('class', 'line')
        .attr('d', navLine(single));
    });


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

    data.forEach(single => {

      // add tooltips
      navChart.selectAll(single[0].term)
        .data(single)
        .enter()
        .append('circle')
        .attr('class', 'circle')
        .attr('cx', function(d) {
          return xScale(d.window.endTime);
        })
        .attr('cy', function(d) {
          return yScale(d.count);
        })
        .attr('r', 2)
        .on('mouseover', tooltip.show)
        .on('mouseout', tooltip.hide)
        .on('click', function(d) {
          $scope.dateSelected(d);
        })

    });

  }
}
