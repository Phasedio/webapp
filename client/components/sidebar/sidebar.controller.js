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
      'title': 'To-Do',
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
    }
    ];

    $scope.isActive = function(route) {
      return route === $location.path();
    };

    var showAdminLink = function(){
      // $scope.sideBarHeight = $("body").height();
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

    var checkTeam = function(){
      // do only after Phased is set up
      if (!Phased.SET_UP) {
        $scope.$on('Phased:setup', checkTeam);
        return;
      }
      $scope.isTrial = (Phased.viewType == "trialing");
    }
    $scope.$on('Phased:PaymentInfo', checkTeam);
    checkTeam();

/*


  function setHeight(){
    // $scope.sideBarHeight = $("body").height() + 200;
    //$scope.$apply();
  }
  // When anything happens make sure height is ajusted.
  $scope.$on('Phased:PaymentInfo', setHeight());
  $scope.$on('Phased:meta', setHeight());
  $scope.$on('Phased:historyComplete', setHeight());
  $scope.$on('Phased:setup', setHeight());
  $scope.$on('Phased:taskAdded', setHeight());
  $scope.$on('Phased:taskDeleted', setHeight());
  $scope.$on('Phased:newStatus', setHeight());*/

  });
