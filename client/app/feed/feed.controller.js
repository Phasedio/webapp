'use strict';

angular.module('webappApp')
  /**
  * filters tasks by status
  *
  * (preface statusID with ! to filter out statuses)
  */
  .filter('filterTaskByStatus', function() {
    return function(input, statusID) {
      if (!input) return input;
      if (!statusID) return input;
      var expected = ('' + statusID).toLowerCase(); // compare lowercase strings
      var result = {}; // output obj

      if (expected[0] === '!') {
        expected = expected.slice(1); // remove leading !
        // negative filter -- filter out tasks with status
        angular.forEach(input, function(value, key) {
          var actual = ('' + value.status).toLowerCase(); // current task's status
          if (actual !== expected) {
            result[key] = value; // preserves index
          }
        });
      } else {
        // only include tasks with status
        angular.forEach(input, function(value, key) {
          var actual = ('' + value.status).toLowerCase(); // current task's status
          if (actual === expected) {
            result[key] = value; // preserves index
          }
        });
      }

      return result;
    }
  })
  /**
  * filters tasks by category
  *
  * (preface statusID with ! to filter out statuses)
  */
  .filter('filterTaskByCategory', function() {
    return function(input, catID) {
      if (!input) return input;
      if (!catID) return input;
      var expected = ('' + catID).toLowerCase(); // compare lowercase strings
      var result = {}; // output obj

      if (expected[0] === '!') {
        expected = expected.slice(1); // remove leading !
        // negative filter -- filter out tasks with cat
        angular.forEach(input, function(value, key) {
          var actual = ('' + value.cat).toLowerCase(); // current task's cat
          if (actual !== expected) {
            result[key] = value; // preserves index
          }
        });
      } else {
        // only include tasks with cat
        angular.forEach(input, function(value, key) {
          var actual = ('' + value.cat).toLowerCase(); // current task's cat
          if (actual === expected) {
            result[key] = value; // preserves index
          }
        });
      }

      return result;
    }
  })
  /**
  *
  * allows ordering an object as if it were an array,
  * at the cost of being able to access its original index
  * Adds a property 'key' with the original index to
  * address this
  *
  */
  .filter('orderObjectBy', function() {
    return function(items, field, reverse) {
      var filtered = [];
      for (var i in items) {
        items[i].key = i;
        filtered.push(items[i]);
      }
      filtered.sort(function (a, b) {
        return (a[field] > b[field] ? 1 : -1);
      });
      if(reverse) filtered.reverse();
      return filtered;
    };
  })
  .controller('FeedCtrl', function ($scope, $http, stripe, Auth, Phased, FURL,amMoment, $location,toaster,$route) {
    ga('send', 'pageview', '/feed');

    // Background image
    var monImage =  "weekdayPhotos/mon.jpg";
    var tuesImage =  "weekdayPhotos/tues.jpg";
    var wedImage =  "weekdayPhotos/wed.jpg";
    var thursImage =  "weekdayPhotos/thurs.jpg";
    var friImage = "weekdayPhotos/fri.jpg";
    var satImage = "weekdayPhotos/sat.jpg";
    var sunImage = "weekdayPhotos/sun.jpg";

    var d=new Date();

    var backgroundImage = [sunImage, monImage, tuesImage, wedImage, thursImage, friImage, satImage];
    $scope.dayImage = backgroundImage[d.getDay()];

    $scope.selectedCategory = '';

    $scope.viewType = Phased.viewType;
    $scope.myID = Auth.user.uid;
    $scope.team = Phased.team;
    $scope.activeStream = Phased.assignments.to_me;
    $scope.activeStatusFilter = '!1'; // not completed tasks
    $scope.taskPriorities = Phased.TASK_PRIORITIES; // in new task modal
    $scope.taskStatuses = Phased.TASK_STATUSES; // in new task modal
    $scope.taskPriorityID = Phased.TASK_PRIORITY_ID;
    $scope.taskStatusID = Phased.TASK_STATUS_ID;
    $scope.user = Phased.user;
    $scope.deleteHolder = '';
    $scope.editHolder = '';



    // bounce users if team has problems
    var checkTeam = function(){
      // do only after Phased is set up
      if (!Phased.SET_UP) {
        $scope.$on('Phased:setup', checkTeam);
        return;
      }
      $scope.countActiveTasks = countActiveTasks();
      var teamCheck = Phased.viewType;
      console.log(teamCheck);
      if (teamCheck == 'problem'){
        $location.path('/team-expired');
      }else if (teamCheck == 'canceled') {
        $location.path('/switchteam');
      }

    }
    $scope.$on('Phased:PaymentInfo', checkTeam);
    checkTeam();

    //Print blank lines in for task area
    $scope.taskTable = [1,2,3,4,5];

    $scope.$on('Phased:history', function() {
      $scope.countActiveTasks = countActiveTasks();
      $scope.$apply();
    });

    $scope.addTask = function(update) {
      ga('send', 'event', 'Update', 'submited');
      mixpanel.track("Updated Status");

      // prepare task object
    	var team = Phased.team.name;
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
      if($scope.selectedTask.name){
        status.task = {
          project : '0A',
          column : '0A',
          card : '0A',
          id : $scope.selectedTask.id,
          name : $scope.selectedTask.name
        }
        $scope.selectedTask = {};
      }

      console.log('status:', status);
      // push to db
      Phased.addStatus(status);

      // reset interface
      $scope.selectedCategory = undefined;
      $scope.task = {};
    } // end $scope.addTask;

    // selects a category, used in addTask
    $scope.categoryChoice = function(key, close){
      ga('send', 'event', 'Update', 'Category selected');
      mixpanel.track("Selected Category");
      $scope.selectedCategory = key;
      if (close) {
        $('#catModal').modal('toggle');
      }
    }

    $scope.moreCat = function(){
      mixpanel.track("Open Category Modal");
      $('#catModal').modal('toggle');
    }

    $scope.addNewCat = function(){
      mixpanel.track("Closed Category Modal");
      $('#catModal').modal('toggle');
      $location.path('/team/addcategory');
    }

    $scope.startTask = function(task) {
      if (!task.user || task.unassigned)
        Phased.takeTask(task.key);
      Phased.activateTask(task.key);

      $scope.activeStream = Phased.assignments.to_me;
      $scope.activeStatusFilter = Phased.TASK_STATUS_ID.ASSIGNED;
    }

    $scope.setTaskCompleted = function(assignmentID) {
      Phased.setAssignmentStatus(assignmentID, Phased.TASK_STATUS_ID.COMPLETE);
    }

    $scope.selectedTask = {};
    $scope.moreTasks = function(){
      mixpanel.track("Open Task Modal");
      $('#taskModal').modal('toggle');
    }
    $scope.taskChoice = function(task){
      mixpanel.track("Add Task to status");
      $scope.selectedTask = task;
      $('#taskModal').modal('toggle');
    }
    $scope.cleartaskChoice = function(){
      mixpanel.track("Cleared Task from status");
      $scope.selectedTask = {};
      $('#taskModal').modal('toggle');
    }
    //Delete status flow
    $scope.deleteSelected = function(item){
      $scope.deleteHolder = item;
    }
    $scope.deleteTask = function(item){
      console.log(item)
      //move this to the PhasedProvider
      var ref = new Firebase(FURL);
      //check if update has task
      if (item.task) {
        //remove task from task statuses history
        var locate = "team/"+Phased.team.uid+"/projects/"+item.task.project+"/columns/"+item.task.column+"/cards/"+item.task.card+"/tasks/"+item.task.id+"/statuses";
        console.log(locate);
        console.log(item.key);
        ref.child(locate)
        .orderByValue()
        .equalTo(item.key)
        .once('value',function(snap){
          var s = snap.val();
          s = Object.keys(s);
          console.log(s);
          console.log(snap.key());
          //var ref = new Firebase(s).set(null);
          ref.child(locate+"/"+s[0]).remove();

          $scope.$apply();
        });
      }
      //rm from FB
      ref.child('team')
      .child(Phased.team.uid)
      .child('statuses')
      .child(item.key)
      .set(null);
      //rm from local
      delete $scope.team.statuses[item.key];
      toaster.pop('success', "Success!", "Your status was deleted!");
    }

    //edit status flow
    $scope.editStatusSelected = function(item){
      $scope.editHolder = angular.copy(item);
      $scope.origItem = item;
    }

    $scope.editStatus = function(){
      console.log($scope.editHolder);
      console.log($scope.origItem);
      var ref = new Firebase(FURL);
      var editedStatus = $scope.editHolder;
      var origStatus = $scope.origItem;
      //check if tasks exists on
      if(editedStatus.task.id){
        //are the tasks the same?
        if (origStatus.task != editedStatus.task) {
          //task was changed or added to status

          // was there a task on the status in the first place?
          if(origStatus.task.id){
            //yes, we should delete the status from the task
            var locate = "team/"+Phased.team.uid+"/projects/"+origStatus.task.project+"/columns/"+origStatus.task.column+"/cards/"+origStatus.task.card+"/tasks/"+origStatus.task.id+"/statuses";
            console.log(locate);
            console.log(origStatus.key);
            ref.child(locate)
            .orderByValue()
            .equalTo(origStatus.key)
            .once('value',function(snap){
              var s = snap.val();
              if(s){
                s = Object.keys(s);
                console.log(s);
                console.log(snap.key());
                ref.child(locate+"/"+s[0]).remove();
              }

            });
          }

          if(editedStatus.task.id != ""){
            //Is there a new task?
            editedStatus.task = {
              project : '0A',
              column : '0A',
              card : '0A',
              id : editedStatus.task.id,
              name : Phased.team.projects['0A'].columns['0A'].cards['0A'].tasks[editedStatus.task.id].name
            }
            ref.child('team').child(Phased.team.uid).child('projects/' + editedStatus.task.project +'/columns/'+editedStatus.task.column +'/cards/'+ editedStatus.task.card +'/tasks/'+editedStatus.task.id+'/statuses').push(origStatus.key);
            //no, lets move on and add it to the new task
          }else{
            editedStatus.task = "";
          }
        }
      }

      ref.child('team').child(Phased.team.uid).child('statuses').child(editedStatus.key).update(editedStatus);
      $scope.team.statuses[$scope.editHolder.key] = editedStatus;
      $('#editModal').modal('toggle');
    }



    // get number of active tasks assigned to userID
    function countActiveTasks(){
      var count = 0;
      var thing = [];
      _.forEach(Phased.team.projects['0A'].columns['0A'].cards['0A'].tasks, function(value, key){
        if((value.status == 0 || value.status == 2) && value.assigned_to == Phased.user.uid){
          count++;
          value.id = key;
          thing.push(value);
        }
      });
      console.log('this did things');
      $scope.getUserTasks = thing;
      console.log(thing);

      return count
    }

  });
