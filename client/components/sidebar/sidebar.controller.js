'use strict';

angular.module('webappApp')
  .controller('SidebarCtrl', function ($scope, $location, Auth, Phased, FURL) {
    $scope.showAdmin = false;
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

    var showAdminLink = function(){
      // do only after Phased is set up
      if (!Phased.SET_UP) {
        $scope.$on('Phased:setup', showAdminLink);
        return;
      }

      var myRole = Phased.team.members[Auth.user.uid].role;
      if (myRole == Phased.ROLE_ID.ADMIN || myRole == Phased.ROLE_ID.OWNER)
        $scope.showAdmin = true;
      else
        $scope.showAdmin = false;
    }
    showAdminLink(); // in case of moving within app and not updating profile

  });
