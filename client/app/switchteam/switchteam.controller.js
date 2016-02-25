'use strict';

angular.module('webappApp')
  .controller('SwitchteamCtrl', function ($scope,FURL,Auth,$http,Phased,toaster,$location) {
    ga('send', 'pageview', '/switchteam');
    var ref = new Firebase(FURL);
    $scope.Phased = Phased;
    $scope.creatingTeam = false;



    // logout
    $scope.logout = function(){
      console.log('logging you out');
      Auth.logout();
      $location.path('/login');
    }

    $scope.addTeam = function(teamName) {
      $scope.creatingTeam = true;
      console.log($scope.Phased.user.email);
      Phased.addTeam(teamName,$scope.Phased.user.email, function success() {
        $location.path("/feed");
        // $('#addTeamModal').modal('hide');
        // toaster.pop('success', 'Success', 'Welcome to Phased, ' + teamName);
      }, function error(teamName) {
        toaster.pop('error', 'Error', teamName + ' already exists. Please ask the team administrator for an invitation to join.');
      });
    }

    $scope.switchTeam = function(id){
      Phased.switchTeam(id);
      $location.path("/feed");
    }
    $scope.$on('Phased:meta', function(){$scope.Phased = Phased; $scope.$apply();});
    $scope.$on('Phased:setup', function(){ $scope.Phased = Phased; $scope.$apply();});



  });
