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
  * filters tasks by assignment
  *
  * (preface direction with ! to filter out users)
  */
  .filter('filterTaskByAssignment', function() {
    return function(input, direction, uid) {
      if (!input) return input;
      if (!direction) return input;
      // direction must be "to" or "by" AND have uid OR be "unassigned" or "delegated"
      if (
        !( (direction == 'to' || direction == 'by') && typeof uid !== 'undefined' )
        && (direction != 'unassigned' && direction != 'delegated')
        )
        return input;

      var result = {}; // output obj

      if (direction[0] === '!') {
        direction = direction.slice(1); // remove leading !
        // negative filter -- filter out tasks with uid
        angular.forEach(input, function(value, key) {
          if (direction == 'to' && uid != value.assigned_to) {
            result[key] = value;
          } else if (direction == 'by' && uid != value.assigned_by) {
            result[key] = value;
          } else if (direction == 'delegated' && !((value.assigned_by != value.assigned_to) && !(value.unassigned)) ) { // delegated if assigned to a different person
            result[key] = value;
          } else if (direction == 'unassigned' && !(value.unassigned)) {
            result[key] = value;
          }
        });
      } else {
        // only include tasks with uid
        angular.forEach(input, function(value, key) {
          if (direction == 'to' && uid == value.assigned_to) {
            result[key] = value;
          } else if (direction == 'by' && uid == value.assigned_by) {
            result[key] = value;
          } else if (direction == 'delegated' && (value.assigned_by != value.assigned_to) && !(value.unassigned) ) { // delegated if assigned to a different person
            result[key] = value;
          } else if (direction == 'unassigned' && value.unassigned) {
            result[key] = value;
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
      types[Phased.task.HISTORY_ID.CREATED] = "Task created";
      types[Phased.task.HISTORY_ID.ARCHIVED] = "Task archived";
      types[Phased.task.HISTORY_ID.UNARCHIVED] = "Task unarchived";
      types[Phased.task.HISTORY_ID.NAME] = "Task name changed";
      types[Phased.task.HISTORY_ID.DESCRIPTION] = "Task description changed";
      types[Phased.task.HISTORY_ID.ASSIGNEE] = "Task assignee changed";
      types[Phased.task.HISTORY_ID.DEADLINE] = "Task deadline changed";
      types[Phased.task.HISTORY_ID.CATEGORY] = "Task category changed";
      types[Phased.task.HISTORY_ID.PRIORITY] = "Task priority changed";
      types[Phased.task.HISTORY_ID.STATUS] = "Task status changed";

      return types[input] || input; // fail gracefully
    }
  }])
  .controller('TasksCtrl', function ($scope, $http, stripe, Auth, Phased, FURL,amMoment,toaster,uiCalendarConfig,$location) {
    ga('send', 'pageview', '/tasks');

    $scope.viewType = Phased.viewType;
    $scope.myID = Auth.user.uid;
    $scope.currentFilter = 'My Tasks';

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


    console.log(Phased);
    $('.dropdown-toggle').dropdown();

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



    }
    $scope.$on('Phased:PaymentInfo', checkTeam);
    checkTeam();

    $scope.$on('Phased:setup', function(){
      $scope.activeAssignmentID = Phased.user.uid;
      console.log($scope.activeAssignmentDirection);
      console.log($scope.activeAssignmentID);
      console.log($scope.activeCategoryFilter);
      console.log($scope.activeStatusFilter);
      $scope.$apply();
    });





    //Move me!!
    //=====================
    //When user clicks on task they can see more information about said task
    $scope.tasklistSize = 'col-xs-10';//set the init size of task list
    $scope.taskDescript = 'hidden'; //hide the task description till the user does something
    $scope.taskInfo = {}; // Task information for the description area


    $scope.selectTask = function(task){
      mixpanel.track("Open Task Details");
      $scope.taskInfo = task; // assign the task information to the scope;

      // if the task list is still 12 cols open up the descriptor for the user
      if($scope.tasklistSize == 'col-xs-10'){
        $scope.tasklistSize = 'col-xs-5';
        $scope.taskDescript = 'task__details__item';
      }
      console.log(task);
      if(typeof task.statuses === 'object'){
        getStatuses(task);
      }

    }

    //closes details sidebar.
    $scope.closeDetails = function(){
      mixpanel.track("Close Task Details");
      $scope.tasklistSize = 'col-xs-10';//set the init size of task list
      $scope.taskDescript = 'hidden'; //hide the task description till the user does something
      $scope.taskInfo = {};
    }

    //grabs any statues that are on the task
    function getStatuses(task){
      $scope.taskInfo.statues = [];
      for (var i in task.statuses) {
        if (task.statuses.hasOwnProperty(i)) {
          console.log(i);
          var item = task.statuses[i];
          FBRef.child('team').child(Phased.user.curTeam).child('statuses').child(item).once('value',function(snap){
            console.log(snap.val());
            $scope.taskInfo.statues.push(snap.val());
          });
        }
      }
    }

    //=====================

    $scope.today = new Date().getTime(); // min date for deadline datepicker

    $scope.Phased = Phased;
    $scope.team = Phased.team;
    $scope.projects = Phased.team.projects;
    $scope.filtersToShow = 'me';
    //$scope.activeAssignmentDirection = 'to';


    // default active stream is 'to_me'
    $scope.activeStatusFilter = '!' + Phased.task.STATUS_ID.COMPLETE; // not completed tasks
    $scope.activeCategoryFilter = undefined;
    $scope.filterView = 'assigned_to_me'; //for the select filter
    $scope.eventSources = []; //needed for the calendar

    $scope.$on('Phased:setup', function() {
      $scope.activeProject = Phased.team.projects['0A']; // default project for now
    });


    /**
    **
    **  event handlers
    **
    */

    //sets filter to the user or to all
    $scope.setFilter = function(filter){
      $scope.filtersToShow = filter;
    }
    $scope.getFilter = function(assignment){

      if ($scope.filtersToShow == 'me') {
        $scope.currentFilter = 'My Tasks';
        if (assignment.assigned_to == Phased.user.uid && assignment.status != Phased.task.STATUS_ID.COMPLETE) {

          return true;
        }else{
          return false;
        }

      }else if ($scope.filtersToShow == 'me_complete') {
        $scope.currentFilter = "My Completed Tasks";
        if (assignment.assigned_to == Phased.user.uid && assignment.status == Phased.task.STATUS_ID.COMPLETE) {

          return true;
        }else{
          return false;
        }

      }else{
        $scope.currentFilter ="All Tasks";
        return true;
      }
    }

    // validates streamName then sets active task stream
    // optionally gets archive if not present
    $scope.setActiveStream = function(streamName) {
      // check and set status
      switch (streamName) {
        case 'all':
          $scope.setStatusFilter(undefined);
          $scope.setAssignmentFilter(undefined);
          break;
        case 'assigned_to_me':
          $scope.setStatusFilter(undefined);
          $scope.setAssignmentFilter('to', Phased.user.uid);
          break;
        case 'assigned_by_me':
          $scope.setStatusFilter(undefined);
          $scope.setAssignmentFilter('by', Phased.user.uid);
          break;
        case 'unassigned':
          $scope.setStatusFilter(undefined);
          $scope.setAssignmentFilter('unassigned');
          break;
        case 'delegated' :
          $scope.setStatusFilter(undefined);
          $scope.setAssignmentFilter('delegated');
          break;
        // case 'archive': // not implemented
        //   Phased.getArchiveFor('all');
        //   $scope.setStatusFilter(undefined);
        //   break;
        // the following aren't an actual address, but at least
        // they let us use the status filter properly...
        case 'completed' :
          $scope.setStatusFilter(Phased.task.STATUS_ID.COMPLETE);
          $scope.setAssignmentFilter(undefined);
          break;
        case 'assigned' :
          $scope.setStatusFilter(Phased.task.STATUS_ID.ASSIGNED);
          $scope.setAssignmentFilter(undefined);
          break;
        case 'in_progress' :
          $scope.setStatusFilter(Phased.task.STATUS_ID.IN_PROGRESS);
          $scope.setAssignmentFilter(undefined);
          break;
        default:
          $scope.setStatusFilter(undefined);
          $scope.setAssignmentFilter(undefined);
          break;
      }

      // $scope.activeStreamName = streamName;
    }

    // checks and sets active status filter
    $scope.setStatusFilter = function(statusID) {
      mixpanel.track("Change Task Filter");
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
        if (!(statusID in Phased.task.STATUS)) {
          statusID = '1';
          filterNot = true;
        }

        // set activeStatusFilter
        $scope.activeStatusFilter = filterNot ? '!' + statusID : statusID;
      }
    }

    // 'assignment' referring to how a task is assigned
    $scope.setAssignmentFilter = function(direction, uid) {
      if (
          (
            (direction == 'to' || direction == 'by')
            && typeof uid !== 'undefined'
          )
          ||
          (direction == 'unassigned' || direction == 'delegated')
        ) {
        $scope.activeAssignmentDirection = direction;
        $scope.activeAssignmentID = uid;
      }
    }
    $scope.setAssignmentFilter('to', Phased.user.uid);

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
      mixpanel.track("Added Assignment to Self");
      // format object
      var status = {
        name: newTask.name,
        cat : newTask.category ? newTask.category : '',
        assigned_by : $scope.myID,
        status: Phased.task.STATUS_ID.ASSIGNED,
        priority : parseInt($scope.newTask.priority)
      };

      if (newTask.deadline)
        status.deadline = newTask.deadline.getTime();

      // set assignee or unassigned
      if (newTask.unassigned || (!('assignee' in newTask) && !('assigned_to' in newTask)))
        status.unassigned = true;
      else if (newTask.assigned_to)
        status.assigned_to = newTask.assigned_to;
      else
        status.assigned_to = newTask.assignee

      // push to db
      Phased.addTask(status);

      //reset current task in feed
      $('#myModal').modal('toggle');
      $scope.newTask = {};
    }


    // shorthand for a quick self-assigned task
    $scope.addTodo = function () {
      mixpanel.track("Added Self-assigned task");
			var newTodo = {
				name: $scope.newTodo.trim(),
				completed: false
			};
      if (!newTodo.name) {
				return;
			}
      var status = {
        name: newTodo.name,
        assigned_by : $scope.myID,
        status: Phased.task.STATUS_ID.ASSIGNED,
        priority : Phased.task.PRIORITY_ID.MEDIUM,
        assigned_to : $scope.myID
      };

      Phased.addTask(status);
      $scope.newTodo = '';
		};

    // then starts it
    $scope.startTask = function(task) {
      mixpanel.track("Started Task");
      Phased.activateTask(task.key, task, "Has started task : ");

      $scope.activeStream = Phased.assignments.to_me;
      $scope.setStatusFilter('!' + Phased.task.STATUS_ID.COMPLETE);
    }

    $scope.moveToArchive = function(assignmentID) {
      mixpanel.track("Moved Task to Archive");
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

    $scope.setTaskCompleted = function(task) {
      mixpanel.track("Complete Task");
      var nameReset = task.name;
      var status = task;
      status.name = "Has completed task : " +status.name;
      status.task = {
        project : '0A',
        column : '0A',
        card : '0A',
        id : task.key,
        name : nameReset
      }
      Phased.addStatus(status);
      task.name = nameReset;
      Phased.setTaskStatus(task.key, Phased.task.STATUS_ID.COMPLETE);

    }
    /* task.name = prefix + task.name;
    _addStatus(task);*/

    // Broadcasts that user is working on Task
    $scope.broadcastTask = function(task) {
      mixpanel.track("Broadcast Task");
      Phased.activateTask(task.key, task, "Is working on task: ");
      toaster.pop('success', "Success!", "Your task was posted");
    }

    // Edit name
    $scope.taskEditName = function(taskID, newName) {
      mixpanel.track("Edit Task Name");
      Phased.setTaskName(taskID, newName);
    }

    // edit description
    $scope.taskEditDesc = function(taskID, desc) {
      mixpanel.track("Edit Task Description");
      Phased.setTaskDesc(taskID, desc);
    }

    // Edit assigned user
    $scope.taskEditAssigned = function(taskID, userID) {
      mixpanel.track("Edit Assignee on Task");
      Phased.setTaskAssignee(taskID, userID);
    }
    // Edits date of deadline or clears it
    $scope.taskEditDate = function(taskID, date) {
      mixpanel.track("Edit Deadline");
      Phased.setTaskDeadline(taskID, date);
    }

    // change category
    $scope.changeCategory = function(taskID, catKey) {
      mixpanel.track("Change Task Category");
      Phased.setTaskCategory(taskID, catKey);
    }
    // change priority
    $scope.changePriority = function(taskID, priorityKey) {
      mixpanel.track("Change Task Priorty");
      Phased.setTaskPriority(taskID, priorityKey);
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
