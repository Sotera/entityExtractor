'use strict';

angular.module('com.module.core')
.directive('telegram', telegramDirective);

function telegramDirective() {
  return {
    controller: telegramController,
    link: link
  };

  function link(scope, elem, attrs, ctrls) {
  }
}

function telegramController($scope, SocialMediaPost) {
  this.create = create;

  function gatherData() {
    let minute = 60 * 1000;
    let intervalSize = $scope.interval * minute;
    let maxDate = Date.now();
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
        return SocialMediaPost.find({
          filter: {
           where: {
              post_type: 'telegram',
              featurizer: 'text',
              timestamp_ms:{between:[window.startTime,window.endTime]}
           }
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
    });


  }

}
