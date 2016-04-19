'use strict';

angular.module('webappApp')
  .config(function ($routeProvider) {
    $routeProvider
      .when('/upgrade', {
        templateUrl: 'app/upgrade/upgrade.html',
        controller: 'UpgradeCtrl'
      });
  });
