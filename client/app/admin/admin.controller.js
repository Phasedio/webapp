'use strict';

angular.module('webappApp')
  .controller('AdminCtrl', function ($scope, $http, stripe, Auth, Phased, FURL,amMoment, $location, toaster) {
    ga('send', 'pageview', '/admin');

    $scope.viewType = Phased.viewType;
    $scope.team = Phased.team;
    console.log(Phased.team);
    $scope.Phased = Phased;
    $scope.numMembers =0;

    // bounce users without Admin or Owner permissions
    var checkRole = function(){
      // do only after Phased is set up
      if (!Phased.SET_UP) {
        $scope.$on('Phased:setup', checkRole);
        return;
      }
      $scope.canAddMembers = function(){
        var k = Object.keys(Phased.team.members);
        console.log(k);
        $scope.numMembers = k.length;
        if(k.length <= 10){
          return true;
        }else{
          return false;
        }
      };

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
      console.log(member,oldRole);
      Phased.changeMemberRole(member.uid, member.role, parseInt(oldRole), function failure(code, message){
        toaster.pop('error', 'Error', message);
      });
    }


    $scope.removeMemberModal = function(member){
      console.log(member);
      $scope.removeThisMember = member;
      //toggle Modal removeMemberModal
      $('#removeMemberModal').modal('toggle');
    }

    $scope.removeMember= function(member){
      $http.post('api/registration/remove-member',{'team':Phased.team.uid,'member':member}).success(function(data){
        console.log('yay');
      })
    }

    /**
    *
    * Add members modal
    *
    */
    $scope.canAddMembers = function(){
      var k = Object.keys(Phased.team.members);
      console.log(k);
      $scope.numMembers = k.length;
      if(k.length <= 10){
        return true;
      }else{
        return false;
      }
    };
    $scope.addMembers = function(newMember) {
      $('#myModal').modal('toggle');
      mixpanel.track("Sent Invite");
      Phased.addMember(newMember);
    };

    $scope.addMemberModal = function() {
      var k = Object.keys(Phased.team.members);
      console.log(k);
      $scope.numMembers = k.length;
      ga('send', 'event', 'Modal', 'Member add');
      $('#myModal').modal('toggle');
    }
  });
