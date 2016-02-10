'use strict';

angular.module('webappApp')
  .config(function ($routeProvider) {
    $routeProvider
      .when('/team-expired', {
        templateUrl: 'app/team-expired/team-expired.html',
        controller: 'TeamExpiredCtrl'
      });
  });
