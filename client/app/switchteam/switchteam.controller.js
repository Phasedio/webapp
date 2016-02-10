'use strict';

angular.module('webappApp')
  .controller('SwitchteamCtrl', function ($scope,FURL,Auth,$http,Phased,toaster,$location) {
    ga('send', 'pageview', '/switchteam');
    var ref = new Firebase(FURL);
    $scope.Phased = Phased;

    $scope.addTeam = function(teamName) {
      Phased.addTeam(teamName, function success() {
        $location.path("/feed");
        // $('#addTeamModal').modal('hide');
        // toaster.pop('success', 'Success', 'Welcome to Phased, ' + teamName);
      }, function error(teamName) {
        toaster.pop('error', 'Error', teamName + ' already exists. Please ask the team administrator for an invitation to join.');
      });
    }

    // $scope.teamList = [];
    // $scope.activeTeam = '';
    //
    // $scope.switchTeams = function(team){
    // 	var ref = new Firebase(FURL);
    // 	ref.child('profile').child(Auth.user.uid).child('curTeam').set(team);
    // }
    //
    // $scope.getCurrentTeam = function(){
    // 	var ref = new Firebase(FURL);
    // 	ref.child('profile').child(Auth.user.uid).child('curTeam').on('value', function(data){
    // 		data = data.val();
    // 		$scope.activeTeam = data;
    // 		$scope.$apply();
    // 	})
    // }
    //
    // $scope.getTeams = function(){
    // 	var ref = new Firebase(FURL);
    // 	ref.child('profile').child(Auth.user.uid).child('teams').once("value",function(data){
    // 		data = data.val();
    // 		console.log(data);
    // 		var holder = []
    // 		var keys = Object.keys(data);
    // 		for(var i = 0 ; i < keys.length; i++){
    // 			$scope.teamList.push(data[keys[i]]);
    // 		}
    // 		console.log($scope.teamList);
    //
    // 		$scope.$apply();
    // 	});
    // }
    // $scope.getTeams();
    // $scope.getCurrentTeam();

  });
