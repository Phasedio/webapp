'use strict';

angular.module('webappApp')
  .config(function ($routeProvider) {
    $routeProvider
      .when('/team/addcategory', {
        templateUrl: 'app/addcategory/addcategory.html',
        controller: 'AddcategoryCtrl'
      });
  });
