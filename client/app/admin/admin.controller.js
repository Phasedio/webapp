'use strict';

angular.module('webappApp')
  .controller('AdminCtrl', function ($scope, $http, stripe, Auth, Phased, FURL,amMoment, $location, toaster) {
    ga('send', 'pageview', '/admin');

    $scope.viewType = Phased.viewType;
    $scope.team = Phased.team;
    console.log(Phased.team);
    $scope.Phased = Phased;

    // checks user's priv immediately, when it loads, and when it changes
    // bounces accordingly
    Phased.maybeBounceUser();

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
