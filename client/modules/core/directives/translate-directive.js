'use strict';

angular.module('com.module.core')
.directive('translate', translateDirective);

function translateDirective(Translate) {
  return {
    controller: translateController,
    scope: {
      phrase: '@'
    },
    template: `<span class='underline'
      title='click to translate'
      ng-click='translate(phrase)'>{{phrase}}</span>`
  };
}

function translateController($scope, Translate) {
  $scope.translate = function(phrase) {
    Translate.toEnglish({ text: phrase })
    .$promise
    .then(text => alert(text[1]))
    .catch(err => alert(JSON.stringify(err)));
  };
}
