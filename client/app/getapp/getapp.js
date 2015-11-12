'use strict';

angular.module('webappApp')
  .config(function ($routeProvider) {
    $routeProvider
      .when('/getapp', {
        templateUrl: 'app/getapp/getapp.html',
        controller: 'GetappCtrl'
      });
  });
