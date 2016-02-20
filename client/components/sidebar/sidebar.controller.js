'use strict';

angular.module('webappApp')
  .controller('SidebarCtrl', function ($scope, $location, Auth, Phased, FURL) {
    $scope.menu = [
    {
      'title': 'Feed',
      'icon': 'rss',
      'link': '/feed'
    },
    {
      'title': 'Tasks',
      'icon': 'check',
      'link' : '/tasks'
    },
    {
      'title': 'Team',
      'icon': 'users',
      'link': '/'
    },
    {
      'title': 'Profile',
      'icon': 'user',
      'link' : '/profile'
    },
    {
      'title': 'Settings',
      'icon': 'cog',
      'link' : '/profile'
    }
    ];

    $scope.isActive = function(route) {
      return route === $location.path();
    };

  });
