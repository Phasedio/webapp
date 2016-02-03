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

    $scope.showAdmin = false;

    // show Admin link if user has permissions
    var showAdminLink = function(){
      if (Auth.user.role == 'admin' || Auth.user.role == 'owner') 
        $scope.showAdmin = true;
      else
        $scope.showAdmin = false;
    }

    showAdminLink(); // in case of moving within app and not updating profile
    $scope.$on('Phased:currentUserProfile', showAdminLink);

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
