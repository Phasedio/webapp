'use strict';

angular.module('webappApp')
  .config(function ($routeProvider) {
    $routeProvider
      .when('/feed', {
        templateUrl: 'app/feed/feed.html',
        controller: 'FeedCtrl'
      });
  });
