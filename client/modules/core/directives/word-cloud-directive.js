'use strict';
angular.module('com.module.core')
  .directive('wordCloud', [
    function() {
      return {
        link: link,
        controller: ['$scope',
          function($scope) {

            this.create = create;
            this.showNewWords = showNewWords;
            var myWordCloud = wordCloud('.cloud-container');

            function create(event, callback) {

            }

            function wordCloud(selector) {

              var $container = $('.cloud-container'),
                width = $container.width(),
                height = $container.height();

              var fill = d3.scaleOrdinal(d3.schemeCategory20);

              //Construct the word cloud's SVG element
              var svg = d3.select(selector).append("svg")
                .attr("width", width)
                .attr("height", height)
                .append("g")
                .attr("transform", "translate("+ width/2 + "," + height/2 + ")");


              //Draw the word cloud
              function draw(words) {
                var cloud = svg.selectAll("g text")
                  .data(words, function(d) { return d.text; });

                //Entering words
                cloud.enter()
                  .append("text")
                  .style("font-family", "Impact")
                  .style("fill", function(d, i) { return fill(i); })
                  .attr("text-anchor", "middle")
                  .attr('font-size', 1)
                  .text(function(d) { return d.text; });

                //Entering and existing words
                cloud
                  .transition()
                  .duration(600)
                  .style("font-size", function(d) {
                    return d.size + "px";
                  })
                  .attr("transform", function(d) {
                    return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
                  })
                  .style("fill-opacity", 1);

                //Exiting words
                cloud.exit()
                  .transition()
                  .duration(200)
                  .style('fill-opacity', 1e-6)
                  .attr('font-size', 1)
                  .remove();
              }


              //Use the module pattern to encapsulate the visualisation code. We'll
              // expose only the parts that need to be public.
              return {

                //Recompute the word cloud for a new set of words. This method will
                // asycnhronously call draw when the layout has been computed.
                //The outside world will need to call this function, so make it part
                // of the wordCloud return value.
                update: function(words) {
                  var $container = $('.cloud-container'),
                    width = $container.width(),
                    height = $container.height();

                  d3.layout.cloud().size([width, height])
                    .words(words)
                    .padding(5)
                    .rotate(function() { return ~~(Math.random() * 2) * 90; })
                    .font("Impact")
                    .fontSize(function(d) {
                      return d.size;
                    })
                    .on("end", function(words){
                      draw(words);
                      draw(words);

                    })
                    .start();
                }
              }

            }

            function getWords(words) {
              var wordObjs = {};
              var blackList = ['the','for','to','on','my','in','and','is','of','are',
                               'he','his',"he's",'im',"i'm",'got','not','from','a','at',
                               "we're",'was','us','be','her',"her's",'them', 'they', 'rt',
                               'you', "your", "you're", 'that','me','has','get','were','it',
                               'me','or','so','no'];
              var max = 1;
              var min = 1;
              var patt = '(';
              blackList.forEach(function(word, i){
                if(i!=0){patt+='|'}
                patt += '\\s' + word + '\\s';
              });
              patt += ')';
              var pattern = new RegExp(patt,'g');

              words = words.toLowerCase();
              words = words.replace(/#\S+/g, ' ');
              words = words.replace(/@\S+/g, ' ');
              words = words.replace(/http\S+/g, ' ');
              words = words.replace(pattern, ' ');
              words = words.replace(/\s+/g,' ').trim();

              words.replace(/[!\.,:;\?]/g, ' ')
                .split(' ')
                .map(function(d) {
                  if(wordObjs[d]){
                    wordObjs[d].count++;
                    if(wordObjs[d].count > max){
                      max = wordObjs[d].count;
                    }
                  }
                  else{
                    wordObjs[d] = {text:d,count:1};
                  }
                });

              var vals = _.values(wordObjs);
              var fontMin = 10;
              var fontMax = 50;

              for (var i in vals)
              {
                var tag = vals[i];

                tag.size = Math.min(fontMax,tag.count/2 *(  tag.count <= min ? 0
                  : (tag.count / max) * (fontMax - fontMin) + fontMin));
                if(tag.size ===0)
                  continue;
                tag.size = Math.max(fontMin,tag.size);
              }

              return _.values(wordObjs);
            }

            function showNewWords(words) {
              if(!words){
                return;
              }
              myWordCloud.update(getWords(words));
            }


          }]
      };

      function link(scope, elem, attrs, ctrls) {
        scope.$watch(attrs['ngModel'], function (v) {
          ctrls.showNewWords(v);
        });
        ctrls.create(null,function(){});
      }

    }]);
