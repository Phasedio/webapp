'use strict';

angular.module('webappApp')
  .controller('NavbarCtrl', function ($scope, $location, Auth, Phased, FURL) {
    $scope.team = Auth.currentTeam;
    $scope.isTrial = false;

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

    // bounce users if team has problems
    var checkTeam = function(){
      // do only after Phased is set up
      if (!Phased.SET_UP) {
        $scope.$on('Phased:setup', checkTeam);
        return;
      }
      // var teamCheck = Phased.viewType;
      // console.log(teamCheck);
      // if (teamCheck == 'problem'){
      //   $location.path('/team-expired');
      // }else if (teamCheck == 'canceled') {
      //   $location.path('/switchteam');
      // }
      if(Phased.viewType == "trialing"){
        $scope.isTrial = true;
        //$scope.$apply();
      }
    }
    $scope.$on('Phased:PaymentInfo', checkTeam);
    checkTeam();

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
