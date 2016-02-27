'use strict';

angular.module('webappApp')
  .config(function ($routeProvider) {
    $routeProvider
      .when('/tasks/:project/:column/:card/:taskID', {
        templateUrl: 'app/taskPage/taskPage.html',
        controller: 'TaskPageCtrl'
      });
  });
