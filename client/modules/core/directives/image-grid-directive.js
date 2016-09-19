'use strict';
angular.module('com.module.core')
.directive('imageGrid', imageGridDirective);

function imageGridDirective($window, $compile) {
  return {
    restrict: 'E',
    link: link,
    template: '<div style="padding-bottom:15px;height:100%;overflow:auto"></div>'
  };

  function link(scope, elem, attrs) {
    // image hover orientation: top-left or bottom-right
    var hoverDir = attrs.hoverDir || 'top-left';

    scope.$watchCollection('imageUrls',
      function(imageUrls) {
        if (imageUrls && imageUrls.length) {
          showImages({ imageUrls, elem, hoverDir, scope });
        } else {
          clearImages(elem);
        }
      }
    );

  }

  function getContainer(elem) {
    return $(elem.children()[0]);
  }

  function clearImages(elem) {
    var container = getContainer(elem);
    container.empty(); // clean slate
    elem.addClass('hide'); // hide element
  }

  function showImages(args) {
    var imageUrls = args.imageUrls,
      el = args.elem,
      container = getContainer(el),
      hoverDir = args.hoverDir,
      scope = args.scope;

    clearImages(el);

    if (imageUrls.length) {
      var frag = $window.document.createDocumentFragment(); // reduces page reflows
      var markup, compiled;
      el.removeClass('hide');

      imageUrls.forEach(url => {
        markup = `<img hover-image animate-marker
          class='grid-image' src='${url}'
          id='${url}' hover-dir='${hoverDir}'>`
        compiled = $compile(angular.element(markup))(scope);
        frag.appendChild(compiled[0]);
      });
      container.append(frag);
    }
  }

}
