'use strict';

angular.module('webappApp')
  .controller('GetappCtrl', function ($scope) {
    ga('send', 'pageview', '/getapp');
    $scope.message = 'Hello';
  });
