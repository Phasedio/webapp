'use strict';

angular.module('webappApp')
  .controller('NavbarCtrl', function ($scope, $location, Auth, Phased, FURL) {
    $scope.team = Auth.currentTeam;
    $scope.phased = Phased;

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
    $scope.$on('Phased:memberChanged', showAdminLink);

    $scope.isCollapsed = true;

    $scope.isActive = function(route) {
      return route === $location.path();
    };
    $scope.logout = function(){
      console.log('logging you out');
      Auth.logout();
      $location.path('/login');
    }

  });
