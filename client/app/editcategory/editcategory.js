'use strict';

angular.module('webappApp')
  .config(function ($routeProvider) {
    $routeProvider
      .when('/team/editcategory', {
        templateUrl: 'app/editcategory/editcategory.html',
        controller: 'EditcategoryCtrl'
      });
  });
