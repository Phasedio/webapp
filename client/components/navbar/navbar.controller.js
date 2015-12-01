'use strict';

angular.module('webappApp')
  .controller('NavbarCtrl', function ($scope, $location, Auth,FURL) {
    $scope.team = Auth.currentTeam;

    $scope.menu = [
    {
      'title': 'Feed',
      'link': '/feed'
    },
    {
      'title': 'Team',
      'link': '/'
    },
    {
      'title': 'Profile',
      'link' : '/profile'
    },
    {
      'title': 'Tasks',
      'link' : '/tasks'
    },
    // {
    //   'title': 'Billing',
    //   'link': '/billing'
    // },
    {
      'title': 'Get App',
      'link': '/getapp'
    }

    ];

    $scope.isCollapsed = true;

    $scope.isActive = function(route) {
      return route === $location.path();
    };
    $scope.logout = function(){
      console.log('logging you out');
      Auth.logout();
      $location.path('/login');
    }

    //Not a fan of this!!!
    window.setInterval(function () {
    $scope.team = Auth.currentTeam;
    $scope.$apply();
    //console.log('yo');
    }, 500);

  });
