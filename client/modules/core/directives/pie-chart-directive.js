'use strict';

angular.module('com.module.core')
.directive('pieChart', pieChartDirective);

function pieChartDirective() {
  return {
    link: link,
    scope: {
      content: '@',
      conf: '@' // d3pie configuration
    }
  };

  function link(scope, element, attrs) {
    scope.$watch('content', newContent => {
      // clear existing content
      element.empty();

      if (newContent == '') return;

      let content = JSON.parse(newContent),
        updatePaths = JSON.parse(attrs.conf);

      if (content.length)
        createChart(element[0], content, updatePaths);
    });

    function createChart(elem, content, updatePaths) {
      let d3conf = {
        'header': {
          'title': {
            'text': '',
            'fontSize': 18,
            'font': 'courier'
          },
          'subtitle': {},
          'location': 'pie-center',
          'titleSubtitlePadding': 10
        },
        'footer': {},
        'size': {
          'canvasHeight': 240,
          'canvasWidth': 300,
          'pieInnerRadius': '87%',
          'pieOuterRadius': '70%'
        },
        'data': {
          'sortOrder': 'label-desc',
          'content': content
        },
        'labels': {
          'outer': {
            'format': 'label-percentage1',
            'pieDistance': 12
          },
          'inner': {
            'format': 'none'
          },
          'mainLabel': {
            'fontSize': 12
          },
          'percentage': {
            'color': '#666',
            'fontSize': 12,
            'decimalPlaces': 0
          },
          'value': {
            'color': '#000',
            'fontSize': 12
          },
          'lines': {
            'enabled': true,
            'color': '#777'
          },
          'truncation': {
            'enabled': false
          }
        },
        'effects': {
          'pullOutSegmentOnClick': {
            'effect': 'linear',
            'speed': 400,
            'size': 8
          }
        },
        'misc': {
          'colors': {
            'segmentStroke': '#000'
          }
        }
      };

      // update by path, to not overwrite nested objects.
      updatePaths.forEach(c => {
        _.set(d3conf, c.path, c.value);
      });
      new d3pie(elem, d3conf);
    }
  }
}
