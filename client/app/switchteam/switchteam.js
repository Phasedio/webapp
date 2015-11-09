'use strict';

angular.module('webappApp')
  .config(function ($routeProvider) {
    $routeProvider
      .when('/switchteam', {
        templateUrl: 'app/switchteam/switchteam.html',
        controller: 'SwitchteamCtrl'
      });
  });
