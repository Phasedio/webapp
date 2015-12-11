'use strict';

angular.module('webappApp')
  .controller('FeedCtrl', function ($scope, $http, stripe, Auth, Phased, FURL,amMoment) {
    ga('send', 'pageview', '/feed');
    var ref = new Firebase(FURL);
    $scope.selectedCategory = '';

    $scope.phased = Phased;
    $scope.viewType = Phased.viewType;
    $scope.myID = Auth.user.uid;
    $scope.team = Phased.team;

    // crutch
    window.setInterval(function(){
      $scope.$apply();
    }, 500);

    // init
    Phased.watchTaskStream();

    $scope.addTask = function(update) {
      ga('send', 'event', 'Update', 'submited');

      // prepare task object
    	var team = $scope.team.name;
    	if ($scope.taskForm.$error.maxlength) {
    		alert('Your update is too long!');
        return;
    	}

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

      console.log('status:', status);
      // push to db
      Phased.addTask(status);

      // reset interface
      $scope.selectedCategory = undefined;
      $scope.task = {};
    } // end $scope.addTask;

    // selects a category, used in addTask
    $scope.categoryChoice = function(key, close){
      ga('send', 'event', 'Update', 'Category selected');
      $scope.selectedCategory = key;
      if (close) {
        $('#catModal').modal('toggle');
      }
    }

  });
