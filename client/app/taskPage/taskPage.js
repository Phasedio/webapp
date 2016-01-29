'use strict';

angular.module('webappApp')
  .config(function ($routeProvider) {
    $routeProvider
      .when('/tasks/:taskID', {
        templateUrl: 'app/taskPage/taskPage.html',
        controller: 'TaskPageCtrl'
      });
  });
