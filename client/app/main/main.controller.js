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
    * Add members modal
    *
    */
    $scope.addMembers = function(newMember) {
      $('#myModal').modal('toggle');
      Phased.addMember(newMember);
    };

    $scope.addMemberModal = function() {
      ga('send', 'event', 'Modal', 'Member add');
      $('#myModal').modal('toggle');
    }

    /**
    *
    * Add team modal
    *
    */
    $scope.$on('Phased:meta', function(){
      if (!Phased.team.uid) {
        $('#addTeamModal').modal('show');
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


    // returns unix timecode for last night at midnight
    var getMidnight = function() {
      var today = [new Date().getDate(),new Date().getMonth(),new Date().getFullYear()];
      var midnight = new Date(today[2],today[1],today[0]).getTime();

      return midnight;
    }

    // get number of status updates for today
    var getTodaysUpdates = function(){
      $scope.stats.todaysTasks = 0;
      var midnight = getMidnight();

      FBRef.child('team/' + Phased.team.uid + '/statuses').orderByChild("time").startAt(midnight).once('value',function(snap){
        $scope.stats.todaysUpdates = snap.numChildren();
      });
    }

    //Check number of completed tasks today
    var getTodaysCompleteTasks = function() {
      $scope.stats.todaysTasks = 0;
      var midnight = getMidnight();

      // loop through tasks
      for (var i in Phased.get.tasks) {
        var thisTask = Phased.get.tasks[i];
        // if this task is complete and completed after midnight today
        if (thisTask.status == Phased.task.STATUS_ID.COMPLETE && thisTask.completeTime >= midnight) {
          $scope.stats.todaysTasks++;
        }
      }
    }

    //Create datapoints for velocity chart
    var getTasksCompletedOverTime = function() {
      $scope.labels = [];
      var midnight = getMidnight();
      //For 30 days ask fb how many tasks we're completed
      for (var i = 0; i < 30; i++) {
        var thisDay = midnight - (i * 86400000); // get the next day
        var endDay = thisDay + 86400000; // get the end point for search

        var l = new Date(thisDay).getDate();
        $scope.labels.push(l);

        var thisDaysVelocity = 0;

        // loop through all tasks; if a task was completed on thisDay, increment velocity
        for (var j in Phased.get.tasks) {
          var thisTask = Phased.get.tasks[j];
          // if this task is complete and completed on this day
          if (thisTask.status == Phased.task.STATUS_ID.COMPLETE && thisTask.completeTime >= thisDay && thisTask.completeTime < endDay) {
            thisDaysVelocity++;
          }
        }

        // add velocity to data array
        $scope.data[0].push(thisDaysVelocity);
      }
      $scope.labels.reverse();
      $scope.data[0].reverse();
    }

    //show category usage in statuses in a pie chart
    var getTodaysCatBreakdown = function(){
      //init break down categories in to labels
      var cLabels = [];
      var cConnector = []; // needed for this array lookup idea
      var cValues = [];
      _.forEach($scope.team.categoryObj, function(n, key) {
        cLabels.push(n.name);
        cConnector.push(key);
        cValues.push(0);
      });

      //get todays date at midnight... in Unix
      var midnight = getMidnight();

      // loop through all statuses
      for (var i in Phased.team.statuses) {
        var thisStatus = Phased.team.statuses[i];
        // if the status is from today and has a category
        if (thisStatus.time >= midnight && 'cat' in thisStatus) {
          //find index of the label in cConnector
          var a = cConnector.indexOf(thisStatus.cat);
          //place a value at that index in cValues
          cValues[a]++;
        }
      }

      $scope.labelsPie = cLabels;
      $scope.dataPie = cValues;
    }

    // do all of the above (resetting their data beforehand)
    var sortData = function() {
      if (!Phased.SET_UP) return;
      
      // reset data
      $scope.labelsPie = ["Download Sales"];
      $scope.data = [[],[0]];
      $scope.dataPie = [0];

      // gather data
      getTodaysUpdates();
      getTodaysCompleteTasks();
      getTasksCompletedOverTime();
      getTodaysCatBreakdown();
    }

    // Chart information -- Clean this up
    $scope.labels = ["January", "February", "March", "April", "May", "June", "July"];
    $scope.series = ['Tasks Completed', 'Series B'];
    $scope.onClick = function (points, evt) {
      console.log(points, evt);
    };


    // when switching to page, sort the data
    sortData();

    // other reasons we might want to refresh the analytics
    $scope.$on('Phased:setup', sortData);
    $scope.$on('Phased:taskAdded', sortData);
    $scope.$on('Phased:taskDeleted', sortData);
    $scope.$on('Phased:newStatus', sortData);

});
