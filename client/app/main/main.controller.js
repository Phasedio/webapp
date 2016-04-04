'use strict';

angular.module('webappApp')
  .controller('MainCtrl', function ($scope, Auth, Phased, toaster, $location) {
    ga('send', 'pageview', '/team');
    $scope.team = Phased.team;
    $scope.Phased = Phased;
    $scope.logout = function(){
      console.log('logging you out');
      Auth.logout();
      $location.path('/login');
    }
    $scope.getTasks = function(){
      
    }
    // $scope.canAddMembers = function(){
    //   var k = Object.keys(Phased.team.members);
    //   $scope.numMembers = k.length;
    //   if(k.length <= 10){
    //     return true;
    //   }else{
    //     return false;
    //   }
    // };
    //

    //
    // /**
    // *
    // * goToMemeber(uid)
    // * sends user to profile of user
    // */
    // $scope.goToUser = function(uid){
    //   $location.path('/profile/' + uid);
    // }
    //
    // /**
    // *
    // * Add team modal
    // *
    // */
    // $scope.$on('Phased:meta', function(){
    //   if (!Phased.team.uid) {
    //     $location.path('/onboarding');
    //   }
    // });
    //
    // $scope.addTeam = function(teamName) {
    //   Phased.addTeam(teamName, function success() {
    //     $('#addTeamModal').modal('hide');
    //     toaster.pop('success', 'Success', 'Welcome to Phased, ' + teamName);
    //   }, function error(teamName) {
    //     toaster.pop('error', 'Error', teamName + ' already exists. Please ask the team administrator for an invitation to join.');
    //   });
    // }
    //
    // $scope.addMembers = function(newMember) {
    //   $('#addMemberModal').modal('toggle');
    //   mixpanel.track("Sent Invite");
    //   Phased.addMember(newMember);
    // };
});
