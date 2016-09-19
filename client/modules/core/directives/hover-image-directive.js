'use strict';
angular.module('com.module.core')
// add behavior to img node to hover above or below original img
.directive('hoverImage', hoverImageDirective);

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
        angular.extend(css, { top: evt.clientY - 175, left: evt.clientX - 175 });
      } else { // bottom-right
        angular.extend(css, { top: evt.clientY + 50, left: evt.clientX + 50 });
      }
      var $dupe = $(this.cloneNode(true))
      .removeClass(origClass)
      .addClass(hoverClass)
      .css(css);
      $body.append($dupe);
    }
  }
}
