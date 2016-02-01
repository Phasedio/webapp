'use strict';

angular.module('webappApp')
  .config(function ($routeProvider) {
    $routeProvider
      .when('/admin/export', {
        templateUrl: 'app/admin-csvDwl/admin-csvDwl.html',
        controller: 'AdminCsvDwlCtrl'
      });
  });
