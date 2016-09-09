'use strict';
angular.module('com.module.core')
  .directive('wordCloud', [
    function() {
      return {
        link: link,
        controller: ['$scope', 'ClusterLink','PostsCluster',
          function($scope, ClusterLink, PostsCluster) {

            this.create = create;
            var myWordCloud = wordCloud('.cloud-container');

            function create(event, callback) {
              showNewWords(myWordCloud);
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
                  .style("font-size", function(d) { return d.size + "px"; })
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
                    .fontSize(function(d) { return d.size; })
                    .on("end", draw)
                    .start();
                }
              }

            }

//Some sample data - http://en.wikiquote.org/wiki/Opening_lines
            var words = [
              "You don't know about me without you have read a book called The Adventures of Tom Sawyer but that ain't no matter.",
              "The boy with fair hair lowered himself down the last few feet of rock and began to pick his way toward the lagoon.",
              "When Mr. Bilbo Bilbo Bilbo Bilbo Baggins Baggins Baggins Baggins of Bag End announced that he would shortly be celebrating celebrating his eleventy-first birthday with a party party party of special special magnificence, there was much talk and excitement in Hobbiton Hobbiton Hobbiton Hobbiton.",
              "It was inevitable: the scent of bitter almonds always reminded him of the fate of unrequited love."
            ];

//Prepare one of the sample sentences by removing punctuation,
// creating an array of words and computing a random size attribute.
            function getWords(i) {
              var n = 16;
              var wordObjs = {};
              words[i]
                .replace(/[!\.,:;\?]/g, '')
                .split(' ')
                .map(function(d) {
                  if(wordObjs[d]){
                    wordObjs[d].size+=10;
                  }
                  else{
                    wordObjs[d] = {text:d,size:20};
                  }
                });
              return _.values(wordObjs);
            }

//This method tells the word cloud to redraw with a new set of words.
//In reality the new words would probably come from a server request,
// user input or some other source.
            function showNewWords(vis, i) {
              i = i || 0;

              vis.update(getWords(2));
              setTimeout(function() { showNewWords(vis, i + 1)}, 2000)
            }


          }]
      };

      function link(scope, elem, attrs, ctrls) {
        ctrls.create(null,function(){});
      }

    }]);



/*

}*/
