'use strict';

angular.module('webappApp')
  .controller('OnboardingCtrl', function ($scope,FURL,Auth,$http,Phased,toaster,$location) {
    $scope.message = 'Hello';
    ga('send', 'pageview', '/switchteam');
    var ref = new Firebase(FURL);
    $scope.Phased = Phased;
    $scope.creatingTeam = false;
    $scope.showThis = 'addteam';


    $scope.$on('Phased:meta', function(){$scope.Phased = Phased; $scope.$apply();});
    $scope.$on('Phased:setup', function(){ $scope.Phased = Phased; $scope.$apply();});
    console.log(Phased.user.email);
    console.log(Phased.user.name);
    console.log(Phased.team.uid);


    // First form
    $scope.addTeam = function(teamName) {

      $scope.creatingTeam = true;
      console.log($scope.Phased.user.email);
      Phased.addTeam(teamName,$scope.Phased.user.email, function success() {

        $scope.showThis = 'addMembers';
        $scope.creatingTeam = false;
        $scope.$apply();
        // $('#addTeamModal').modal('hide');
        // toaster.pop('success', 'Success', 'Welcome to Phased, ' + teamName);
      }, function error(teamName) {
        toaster.pop('error', 'Error', teamName + ' already exists. Please ask the team administrator for an invitation to join.');
      });
    }

    //Second form

    $scope.inviteMembers = function(invite1,invite2,invite3) {
      //console.log(invite);
      console.log(Phased.user.email);
      console.log(Phased.user.name);
      console.log(Phased.team.uid);
      // $('#myModal').modal('toggle');
      // mixpanel.track("Sent Invite");
      if(invite1){
        console.log(invite1);
        var k = { email: invite1};
        Phased.addMember(k);
      }
      if(invite2){
        var j = { email: invite2};
        Phased.addMember(j);
      }
      if(invite3){
        var f = { email: invite3};
        Phased.addMember(f);
      }
      $scope.showThis = 'addUpdate';
      // Phased.addMember(newMember);
    };

    // Third form

    $scope.addUpdate = function(update) {
      ga('send', 'event', 'Update', 'submited');
      mixpanel.track("Updated Status");

      // prepare task object
    	var team = Phased.team.name;
	    var taskPrefix = '';

	    var status = {
	      name: taskPrefix + update.name,
	      // time: new Date().getTime(), // added in PhasedProvider.makeTaskForDB (internal fn)
	      user: Auth.user.uid,
	      cat : $scope.selectedCategory || '',
	      city: $scope.city || 0,
	      weather: '',
	      taskPrefix : taskPrefix,
	      photo : $scope.bgPhoto || 0,
	      location: {
	        lat : $scope.lat || 0,
	        long : $scope.long || 0
	      }
	    };

      // push to db
      Phased.addStatus(status);


      $location.path("/feed");
    } // end $scope.addTask;

  });
