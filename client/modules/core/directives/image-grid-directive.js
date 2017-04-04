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
    // image hover orientation: top-left, bottom-right, left.
    // depends on hoverImage directive.
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

    // set selected image
    elem.click(function(el) {
      var $el = $(el.target);
      elem.find('img').removeClass('highlight');
      $el.addClass('highlight');

      scope.$apply(function() {
        scope.selectedImageUrl = $el.attr('src');
      });
    });
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
      // docfrags reduce page reflows
      var frag = $window.document.createDocumentFragment(),
        markup, compiled;
      el.removeClass('hide');

      imageUrls.forEach(url => {
        markup = `<img hover-image class='grid-image' src='${url}'
          id='${url}' hover-dir='${hoverDir}'>`
        compiled = $compile(angular.element(markup))(scope);
        frag.appendChild(compiled[0]);
      });
      container.append(frag);
    }
  }

}
