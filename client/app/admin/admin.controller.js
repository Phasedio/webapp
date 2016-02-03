'use strict';

angular.module('webappApp')
  .controller('AdminCtrl', function ($scope, $http, stripe, Auth, Phased, FURL,amMoment, $location) {
    ga('send', 'pageview', '/admin');

    $scope.viewType = Phased.viewType;
    $scope.myID = Auth.user.uid;
    $scope.team = Phased.team;
    $scope.Phased = Phased;

    // bounce users without Admin or Owner permissions
    var checkRole = function(){
      // do only after Phased is set up
      if (!Phased.SET_UP) {
        $scope.$on('Phased:setup', checkRole);
        return;
      }

      var myRole = Phased.team.members[Auth.user.uid].role;
      if (myRole != Phased.ROLE_ID.ADMIN && myRole != Phased.ROLE_ID.OWNER) 
        $location.path('/');
    }
    checkRole();


  $scope.changeRole = function(member, oldRole) {
    Phased.changeMemberRole(member.uid, member.role, oldRole);
  }

  });
