'use strict';

angular.module('com.module.core')
.directive('hoverImage', hoverImageDirective);

// add behavior to img node to hover above or below original img
function hoverImageDirective() {
  var $body = $('body'); // abs. position from body

  return {
    link: link
  };

  function link(scope, element, attrs) {
    // image hover orientation: top-left or bottom-right
    var hoverDir = attrs.hoverDir || 'top-left',
      origClass = attrs.class,
      hoverClass = origClass + '-hover';

    element.hover(
      _.debounce(mouseOnImage, 667),
      _.debounce(mouseOffImage, 667)
    );

    element.dblclick(function(e) {
      // stop here. don't get to overlay handler.
      e.stopPropagation();
    });

    function mouseOffImage(evt) {
      $body.find('.' + hoverClass).remove();
    }

    function mouseOnImage(evt) {
      var css = { position: 'absolute', zIndex: 100 };
      if (hoverDir === 'top-left') {
        angular.extend(css, { top: evt.clientY - 400, left: evt.clientX - 180 });
      } else if(hoverDir==='bottom-right') { // bottom-right
        angular.extend(css, { top: evt.clientY + 50, left: evt.clientX + 50 });
      }else if(hoverDir==='left'){
        angular.extend(css, { top: evt.clientY-200, left: evt.clientX - 400 });
      }
      var $dupe = $(this.cloneNode(true))
      .removeClass(origClass)
      .addClass(hoverClass)
      .css(css);
      $body.append($dupe);
    }
  }
}
