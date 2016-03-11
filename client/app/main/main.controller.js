'use strict';

angular.module('webappApp')
  .controller('MainCtrl', function ($scope, $http, stripe, Auth, Phased, FURL,amMoment,toaster, $location) {
    ga('send', 'pageview', '/team');
    $scope.showMember = false;
    $scope.team = Phased.team;
    $scope.viewType = Phased.viewType;
    $scope.Phased = Phased;
    var FBRef = new Firebase(FURL);

    //stats vars
    $scope.numUpdates = 0;
    $scope.stats = {
      todaysUpdates : 0,
      todaysTasks : 0

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


    // bounce users if team has problems
    var checkTeam = function(){
      // do only after Phased is set up
      if (!Phased.SET_UP) {
        $scope.$on('Phased:setup', checkTeam);
        return;
      }
      var teamCheck = Phased.viewType;
      console.log(teamCheck);
      if (teamCheck == 'problem'){
        $location.path('/team-expired');
      }else if (teamCheck == 'canceled') {
        $location.path('/switchteam');
      }
      $scope.canAddMembers();

    }
    $scope.$on('Phased:PaymentInfo', checkTeam);
    checkTeam();

    /**
    *
    * goToMemeber(uid)
    * sends user to profile of user
    */
    $scope.goToUser = function(uid){
      $location.path('/profile/' + uid);
    }



    /**
    *
    * Add team modal
    *
    */
    $scope.$on('Phased:meta', function(){
      if (!Phased.team.uid) {
        $location.path('/onboarding');
        //$('#addTeamModal').modal('show');
      }
    });

    $scope.addTeam = function(teamName) {
      Phased.addTeam(teamName, function success() {
        $('#addTeamModal').modal('hide');
        toaster.pop('success', 'Success', 'Welcome to Phased, ' + teamName);
      }, function error(teamName) {
        toaster.pop('error', 'Error', teamName + ' already exists. Please ask the team administrator for an invitation to join.');
      });
    }

    $scope.addMembers = function(newMember) {
      $('#addMemberModal').modal('toggle');
      mixpanel.track("Sent Invite");
      Phased.addMember(newMember);
    };
});
