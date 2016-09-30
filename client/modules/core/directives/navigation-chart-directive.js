'use strict';

angular.module('com.module.core')
.directive('navigationChart', navigationChartDirective);

function navigationChartDirective() {
  return {
    controller: navigationChartController,
    link: link
  };

  function link(scope, elem, attrs, ctrls) {
    ctrls.create(null, angular.noop);
  }
}

function navigationChartController($scope, ClusterLink, JobMonitor) {
  this.create = create;

  function create(event, callback) {
    JobMonitor.find({
      filter: {
        where: {
          featurizer: 'linker'
        }
      }
    })
    .$promise
    .then(aggregateJobs)
    .catch(console.error);
  }

  function aggregateJobs(jobs){
    var minDate,maxDate;
    var minCount = 0, maxCount = 0;
    var data = [];
    var finishedCount = 0;
    jobs.forEach(function(job) {
      var query = {where: {end_time_ms: job.end_time}};
      ClusterLink.count(query)
        .$promise
        .then(function(result){
          finishedCount++;
          if (result.count != 0) {
            if (!minDate) {
              minDate = job.start_time;
              maxDate = job.end_time;
            }
            minDate = job.start_time < minDate ? job.start_time : minDate;
            maxDate = job.end_time > maxDate ? job.end_time : maxDate;

            minCount = result.count < minCount ? result.count : minCount;
            maxCount = result.count > maxCount ? result.count : maxCount;

            data.push({
              count: result.count,
              date: new Date(job.end_time)
            });
          }

          if (finishedCount == jobs.length){
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
            graphClusterLinkCounts(data, new Date(minDate), new Date(maxDate), minCount, maxCount);
          }
        })
        .catch(console.error);
    });
  }

  function graphClusterLinkCounts(data, minDate, maxDate, yMin, yMax) {
    var margin = {top: 30, right: 0, bottom: 20, left: 50};

    var $container = $('.nav-chart-container'),
      width = $container.width(),
      height = $container.height();

    var navWidth = width - margin.left - margin.right,
      navHeight = height - margin.top - margin.bottom;

    var navChart = d3.select('.nav-chart-container')
      .classed('chart', true).append('svg')
      .classed('navigator', true)
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    var navXScale = d3.scaleTime()
        .domain([minDate, maxDate])
        .range([0, navWidth]);

    var navYScale = d3.scaleLinear()
        .domain([yMin, yMax])
        .range([navHeight, 0]);

    var navData = d3.area()
      .x(function(d) {
        return navXScale(d.date);
      })
      .y0(navHeight)
      .y1(function(d) {
        return navYScale(d.count);
      });

    var navLine = d3.line()
      .x(function(d) {
        return navXScale(d.date);
      })
      .y(function(d) {
        return navYScale(d.count);
      });

    navChart.append('path')
      .attr('class', 'data')
      .attr('d', navData(data));

    navChart.append('path')
      .attr('class', 'line')
      .attr('d', navLine(data));

    var viewport = d3.brushX()
      .on('end', function () {
        redrawChart();
      });

    var navXAxis = d3.axisBottom(navXScale);

    navChart.append('g')
      .attr('class', 'x axis')
      .attr('transform', 'translate(0,' + navHeight + ')')
      .call(navXAxis);

    var navYAxis = d3.axisLeft(navYScale);

    navChart.append('g')
      .attr('class', 'y axis')
      .call(navYAxis)
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
      var start = navXScale.invert( d3.event.selection[0] );
      var end = navXScale.invert( d3.event.selection[1] );
      $scope.dateRangeSelected(start.getTime(),end.getTime());
    }

    navChart.append('g')
      .attr('class', 'viewport')
      .call(viewport)
      .selectAll('rect')
      .attr('height', navHeight);
  }
}
