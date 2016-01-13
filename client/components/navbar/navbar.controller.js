'use strict';

angular.module('webappApp')
  .controller('NavbarCtrl', function ($scope, $location, Auth, FURL) {
    $scope.team = Auth.currentTeam;

    $scope.menu = [
    {
      'title': 'Feed',
      'link': '/feed'
    },
    {
      'title': 'Tasks',
      'link' : '/tasks'
    },
    {
      'title': 'Team',
      'link': '/'
    },
    {
      'title': 'Profile',
      'link' : '/profile'
    }
    ];

    $scope.$on('Phased:currentUserProfile', function(){
      if (Auth.user.role == 'Admin' || Auth.user.role == 'Owner') 
        $scope.menu.push({ 'title': 'Admin', 'link' : '/admin' });
      else
        if ($scope.menu[$scope.menu.length - 1].title == 'Admin')
          $scope.menu.pop();
    });

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
