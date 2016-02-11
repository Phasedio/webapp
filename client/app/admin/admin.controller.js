'use strict';

angular.module('webappApp')
  .controller('AdminCtrl', function ($scope, $http, stripe, Auth, Phased, FURL,amMoment, $location, toaster) {
    ga('send', 'pageview', '/admin');

    $scope.viewType = Phased.viewType;
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

    // bounce users if team has problems
    var checkTeam = function(){
      // do only after Phased is set up
      if (!Phased.SET_UP) {
        $scope.$on('Phased:setup', checkTeam);
        return;
      }
      var teamCheck = Phased.viewType;
      if (teamCheck == 'problem'){
        $location.path('/team-expired');
      }else if (teamCheck == 'canceled') {
        $location.path('/switchteam');
      }

    }
    checkTeam();

    $scope.$on('Phased:memberChanged', checkRole);

    $scope.changeRole = function(member, oldRole) {
      Phased.changeMemberRole(member.uid, member.role, parseInt(oldRole), function failure(code, message){
        toaster.pop('error', 'Error', message);
      });
    }
  });
