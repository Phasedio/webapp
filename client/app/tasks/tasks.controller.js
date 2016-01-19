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
  /**
  *
  * change a task history change code to plain text
  * (lookup allows for easier text changes later)
  *
  */
  .filter('historyType', ['Phased', function(Phased) {
    return function(input) {
      var types = {};
      types[Phased.TASK_HISTORY_CHANGES.CREATED] = "Task created";
      types[Phased.TASK_HISTORY_CHANGES.ARCHIVED] = "Task archived";
      types[Phased.TASK_HISTORY_CHANGES.UNARCHIVED] = "Task unarchived";
      types[Phased.TASK_HISTORY_CHANGES.NAME] = "Task name changed";
      types[Phased.TASK_HISTORY_CHANGES.DESCRIPTION] = "Task description changed";
      types[Phased.TASK_HISTORY_CHANGES.ASSIGNEE] = "Task assignee changed";
      types[Phased.TASK_HISTORY_CHANGES.DEADLINE] = "Task deadline changed";
      types[Phased.TASK_HISTORY_CHANGES.CATEGORY] = "Task category changed";
      types[Phased.TASK_HISTORY_CHANGES.PRIORITY] = "Task priority changed";
      types[Phased.TASK_HISTORY_CHANGES.STATUS] = "Task status changed";

      return types[input] || input; // fail gracefully
    }
  }])
  .controller('TasksCtrl', function ($scope, $http, stripe, Auth, Phased, FURL,amMoment,toaster,uiCalendarConfig) {
    ga('send', 'pageview', '/tasks');

    $scope.viewType = Phased.viewType;
    $scope.taskPriorities = Phased.TASK_PRIORITIES; // in new task modal
    $scope.taskStatuses = Phased.TASK_STATUSES; // in new task modal
    $scope.taskPriorityID = Phased.TASK_PRIORITY_ID;
    $scope.taskStatusID = Phased.TASK_STATUS_ID;
    $scope.taskHistType = Phased.TASK_HISTORY_CHANGES;
    $scope.myID = Auth.user.uid;

    console.log(Phased);

    $scope.today = new Date().getTime();
    var StatusID = {
        IN_PROGRESS : 0,
        COMPLETE : 1,
        ASSIGNED : 2
      },
      PriorityID = {
        HIGH : 0,
        MEDIUM : 1,
        LOW : 2
      },
      FBRef = new Firebase(FURL);

      // Background image
    var monImage =  "weekdayPhotos/mon.jpg";
    var tuesImage =  "weekdayPhotos/tues.jpg";
    var wedImage =  "weekdayPhotos/wed.jpg";
    var thursImage =  "weekdayPhotos/thurs.jpg";
    var friImage = "weekdayPhotos/fri.jpg";
    var satImage = "weekdayPhotos/sat.jpg";
    var sunImage = "weekdayPhotos/sun.jpg";

    var d=new Date();
    console.log(d.getDay());
    $('.dropdown-toggle').dropdown()



    var backgroundImage = [sunImage, monImage, tuesImage, wedImage, thursImage, friImage, satImage];
    $scope.dayImage = backgroundImage[d.getDay()];



    //Move me!!
    //=====================
    //When user clicks on task they can see more information about said task
    $scope.tasklistSize = 'col-xs-12';//set the init size of task list
    $scope.taskDescript = 'hidden'; //hide the task description till the user does something
    $scope.taskInfo = {}; // Task information for the description area


    $scope.selectTask = function(task){
      $scope.taskInfo = task; // assign the task information to the scope;
      // if the task list is still 12 cols open up the descriptor for the user
      if($scope.tasklistSize == 'col-xs-12'){
        $scope.tasklistSize = 'col-xs-6';
        $scope.taskDescript = 'col-xs-6';
      }

    }

    //closes details sidebar.
    $scope.closeDetails = function(){
      $scope.tasklistSize = 'col-xs-12';//set the init size of task list
      $scope.taskDescript = 'hidden'; //hide the task description till the user does something
      $scope.taskInfo = {};
    }

    //=====================

    $scope.today = new Date().getTime(); // min date for deadline datepicker

    $scope.phased = Phased;
    $scope.team = Phased.team;
    $scope.assignments = Phased.assignments;
    $scope.archive = Phased.archive;

    // default active stream is 'to_me'
    $scope.activeStream = Phased.assignments.to_me;
    $scope.activeStreamName = 'assignments.to_me';
    $scope.activeStatusFilter = '!' + Phased.TASK_STATUS_ID.COMPLETE; // not completed tasks
    $scope.activeCategoryFilter = undefined;
    $scope.filterView = $scope.activeStreamName;//for the select filter
    $scope.eventSources = [];//needed for the calendar


    /**
    **
    **  event handlers
    **
    */

    // validates streamName then sets active task stream
    // optionally gets archive if not present
    $scope.setActiveStream = function(streamName) {
      // check and set status
      switch (streamName) {
        case 'assignments.all':
          $scope.activeStream = Phased.assignments.all;
          $scope.setStatusFilter('!' + Phased.TASK_STATUS_ID.COMPLETE);
          break;
        case 'assignments.to_me':
          $scope.activeStream = Phased.assignments.to_me;
          $scope.setStatusFilter('!' + Phased.TASK_STATUS_ID.COMPLETE);
          break;
        case 'assignments.by_me':
          $scope.activeStream = Phased.assignments.by_me;
          $scope.setStatusFilter(undefined);
          break;
        case 'assignments.unassigned':
          $scope.activeStream = Phased.assignments.unassigned;
          $scope.setStatusFilter(undefined);
          break;
        case 'archive.to_me':
          if (!('to_me' in Phased.archive)) Phased.getArchiveFor('to_me'); // get archive if needed
          $scope.activeStream = Phased.archive.to_me;
          $scope.setStatusFilter(undefined);
          break;
        case 'archive.all':
          Phased.getArchiveFor('all');
          $scope.activeStream = Phased.archive.all;
          $scope.setStatusFilter(undefined);
          break;
        // the following aren't an actual address, but at least 
        // they let us use the status filter properly...
        case 'completed' : 
          $scope.activeStream = Phased.assignments.all;
          streamName = 'assignments.all'; // jimmy this in there...
          $scope.setStatusFilter(Phased.TASK_STATUS_ID.COMPLETE);
          break;
        case 'assigned' : 
          $scope.activeStream = Phased.assignments.all;
          streamName = 'assignments.all'; 
          $scope.setStatusFilter(Phased.TASK_STATUS_ID.ASSIGNED);
          break;
        case 'in_progress' : 
          $scope.activeStream = Phased.assignments.all;
          streamName = 'assignments.all'; 
          $scope.setStatusFilter(Phased.TASK_STATUS_ID.IN_PROGRESS);
          break;
        default:
          $scope.activeStream = Phased.assignments.to_me;
          $scope.setStatusFilter('!' + Phased.TASK_STATUS_ID.COMPLETE);
          streamName = 'assignments.to_me';
          break;
      }

      $scope.activeStreamName = streamName;
    }

    // checks and sets active status filter
    $scope.setStatusFilter = function(statusID) {
      // check and set filter
      if (statusID === null || typeof statusID == 'undefined') {
        $scope.activeStatusFilter = undefined;
      } else {
        statusID = statusID.toString();

        // check for negating character
        var filterNot = false;
        if (statusID[0] === '!') {
          filterNot = true;
          statusID.slice(1);
        }

        // default to 'not COMPLETE' on false
        if (!(statusID in Phased.TASK_STATUSES)) {
          statusID = '1';
          filterNot = true;
        }

        // set activeStatusFilter
        $scope.activeStatusFilter = filterNot ? '!' + statusID : statusID;
      }
    }

    // toggles category filter
    $scope.toggleCategoryFilter = function(catID) {
      $scope.activeCategoryFilter == catID ?
        $scope.activeCategoryFilter = undefined :
        $scope.setCategoryFilter(catID);
    }

    // sets the active category filter
    $scope.setCategoryFilter = function(catID) {
      $scope.activeCategoryFilter = catID;
    }

    $scope.addAssignment = function(newTask){
      // format object
      var taskPrefix = '',
        weather = '';
      var status = {
        name: taskPrefix + newTask.name,
        cat : newTask.category ? newTask.category : '',
        city: $scope.city ? $scope.city : 0,
        weather: weather,
        taskPrefix : taskPrefix,
        photo : $scope.bgPhoto ? $scope.bgPhoto : 0,
        location: {
          lat : $scope.lat ? $scope.lat : 0,
          long : $scope.long ? $scope.long : 0
        },
        assigned_by : $scope.myID,
        status: Phased.TASK_STATUS_ID.ASSIGNED,
        priority : parseInt($scope.newTask.priority)
      };

      if (newTask.deadline)
        status.deadline = newTask.deadline.getTime();

      // set assignee or unassigned
      if (newTask.unassigned)
        status.unassigned = true;
      else if (newTask.assignee)
        status.assignee = newTask.assignee;
      else {
        console.log('no assignee but not unassigned; breaking...');
        return;
      }


      // push to db
      Phased.addAssignment(status);

      //reset current task in feed
      $('#myModal').modal('toggle');
      $scope.newTask = {};
    }

    $scope.addTodo = function () {
			var newTodo = {
				name: $scope.newTodo.trim(),
				completed: false
			};
      if (!newTodo.name) {
				return;
			}
      // format object
      var taskPrefix = '',
        weather = '';
      var status = {
        name: taskPrefix + newTodo.name,
        cat : '',
        city: 0,
        weather: weather,
        taskPrefix : taskPrefix,
        photo :  0,
        location: {
          lat :  0,
          long :  0
        },
        assigned_by : $scope.myID,
        status: Phased.TASK_STATUS_ID.ASSIGNED,
        priority : 1
      };
      status.assignee = $scope.myID;



      Phased.addAssignment(status);
      $scope.newTodo = '';
			// $scope.saving = true;
			// store.insert(newTodo)
			// 	.then(function success() {
			// 		$scope.newTodo = '';
			// 	})
			// 	.finally(function () {
			// 		$scope.saving = false;
			// 	});
		};

    // moves task into my to_me if unassigned,
    // then starts it
    $scope.startTask = function(task) {
      if (!task.user || task.unassigned)
        Phased.takeTask(task.key);
      Phased.activateTask(task.key);

      $scope.activeStream = Phased.assignments.to_me;
      $scope.setStatusFilter('!' + Phased.TASK_STATUS_ID.COMPLETE);
    }

    $scope.moveToArchive = function(assignmentID) {
      Phased.moveToFromArchive(assignmentID);
      $scope.closeDetails();
    }

    $scope.moveFromArchive = function(assignmentID) {
      Phased.moveToFromArchive(assignmentID, true);
    }

    // gets archived tasks at address shows archive
    $scope.getArchiveFor = function(address) {
      Phased.getArchiveFor(address);
    }

    $scope.setTaskCompleted = function(assignmentID) {
      Phased.setAssignmentStatus(assignmentID, Phased.TASK_STATUS_ID.COMPLETE);
    }

    // Broadcasts that user is working on Task
    $scope.broadcastTask = function(task) {
      Phased.activateTask(task.key);
      toaster.pop('success', "Success!", "Your task was posted");
    }

    // Edit name
    $scope.taskEditName = function(taskID, newName) {
      Phased.editTaskName(taskID, newName);
    }

    // edit description
    $scope.taskEditDesc = function(taskID, desc) {
      Phased.editTaskDesc(taskID, desc);
    }

    // Edit assigned user
    $scope.taskEditAssigned = function(taskObj, userID) {
      Phased.editTaskAssignee(taskObj, userID);
    }
    // Edits date of deadline or clears it
    $scope.taskEditDate = function(taskID, date) {
      Phased.editTaskDeadline(taskID, date);
    }

    // change category
    $scope.changeCategory = function(taskID, catKey) {
      Phased.editTaskCategory(taskID, catKey);
    }
    // change priority
    $scope.changePriority = function(taskID, priorityKey) {
      Phased.editTaskPriority(taskID, priorityKey);
    }








    //----
    $scope.today = function() {
      $scope.dt = new Date();
    };
  $scope.today();

  $scope.clear = function () {
    $scope.dt = null;
  };

  // Disable weekend selection
  $scope.disabled = function(date, mode) {
    return ( mode === 'day' && ( date.getDay() === 0 || date.getDay() === 6 ) );
  };

  $scope.toggleMin = function() {
    $scope.minDate = $scope.minDate ? null : new Date();
  };
  $scope.toggleMin();
  $scope.maxDate = new Date(2020, 5, 22);

  $scope.open = function($event) {
    $scope.status.opened = true;
  };

  $scope.setDate = function(year, month, day) {
    console.log('youre picking a new day')
    $scope.dt = new Date(year, month, day);
  };

  $scope.dateOptions = {
    formatYear: 'yy',
    startingDay: 1
  };

  $scope.formats = ['dd-MMMM-yyyy', 'yyyy/MM/dd', 'dd.MM.yyyy', 'shortDate'];
  $scope.format = $scope.formats[0];

  $scope.status = {
    opened: false
  };


  $scope.events =[];

  $scope.getDayClass = function(date, mode) {
    if (mode === 'day') {
      var dayToCheck = new Date(date).setHours(0,0,0,0);

      for (var i=0;i<$scope.events.length;i++){
        var currentDay = new Date($scope.events[i].date).setHours(0,0,0,0);

        if (dayToCheck === currentDay) {
          return $scope.events[i].status;
        }
      }
    }

    return '';
  };

    //---

    /**
    * pop open add task modal
    */
    $scope.addAssignmentModal = function(){
      ga('send', 'event', 'Modal', 'Task add');
      $('#myModal').modal('toggle');
    }

});
