'use strict';

angular.module('webappApp')
  .controller('NavbarCtrl', function ($scope, $location) {
    $scope.menu = [
    {
      'title': 'Team',
      'link': '/'
    },
    {
      'title': 'Billing',
      'link': '/billing'
    }
    
    ];

    $scope.isCollapsed = true;

    $scope.isActive = function(route) {
      return route === $location.path();
    };
  });