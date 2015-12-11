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
    	var team = $scope.team.name;
    	if ($scope.taskForm.$error.maxlength) {
    		alert('Your update is too long!');
    	} else {
    		console.log(update);
		    var taskPrefix = '';
		    var weather,city,lat,long,photo,cat;
		    cat = $scope.selectedCategory ? $scope.selectedCategory : '';
		    city = $scope.city ? $scope.city : 0;
		    lat = $scope.lat ? $scope.lat : 0;
		    long = $scope.long ? $scope.long : 0;
		    photo = $scope.bgPhoto ? $scope.bgPhoto : 0;
		    var status = {
		      name: taskPrefix+update.name,
		      time: new Date().getTime(),
		      user:Auth.user.uid,
		      cat : $scope.selectedCategory,
		      city:city,
		      weather:'',
		      taskPrefix : taskPrefix,
		      photo : photo,
		      location: {
		        lat : lat,
		        long : long
		      }
		    };
		    var teamRef = new Firebase(FURL);
		    console.log(status);
        console.log(status.time);
		    teamRef.child('team').child(team).child('task').child(Auth.user.uid).set(status);
		    teamRef.child('team').child(team).child('all').child(Auth.user.uid).push(status,function(){
		      console.log('status set');
		      $scope.updateStatus = '';
          //we are getting the user.uid, we need to extract the member off the user.uid.
          //then we can do a scope.setSelected off that member.

          //Send push notifications to team
		      // $http.get('http://45.55.200.34:8080/push/update/'+team+'/'+Auth.user.name+'/'+status.name,'').success(function(data){
		      //   //alert(data);
		      // });
		    });

		    $scope.task = update;
        $scope.task.name = '';

		    $scope.showTaskView = true;
        $scope.taskTime = status.time; // we didnt have status.time so i think this fixes the problem(?)
        // maybe we need a timeout function here to run around out $apply()??

        //$scope.$apply();

        //need to find out what the member/who is
        //$scope.getTaskHistory(member);
	    }
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
