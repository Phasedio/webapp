'use strict';

angular.module('webappApp')
  
  .controller('TasksCtrl', function ($scope, $http, Auth, Phased, FURL,amMoment,toaster,uiCalendarConfig,$location) {
    ga('send', 'pageview', '/tasks');

    $scope.viewType = Phased.viewType;
    $scope.myID = Auth.user.uid;
    $scope.currentFilter = 'My Tasks';

    $scope.today = new Date().getTime();
    var FBRef = new Firebase(FURL);

    $('.dropdown-toggle').dropdown();

    $scope.activeAssignmentID = Phased.user.uid;





    //Move me!!
    //=====================
    //When user clicks on task they can see more information about said task
    $scope.tasklistSize = 'col-xs-10';//set the init size of task list
    $scope.taskDescript = 'hidden'; //hide the task description till the user does something
    $scope.taskInfo = {}; // Task information for the description area

    $scope.sendToTask = function(project,column,card,key){

      $location.path('/tasks/'+ project +'/'+ column +'/'+ card +'/'+ key);
    }


    $scope.setCompleted = function(task) {
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
      toaster.pop('success', "Task Complete!", "Great work!");

    }

    $scope.selectTask = function(task){
      mixpanel.track("Open Task Details");
      $scope.taskInfo = task; // assign the task information to the scope;

      // if the task list is still 12 cols open up the descriptor for the user
      if($scope.tasklistSize == 'col-xs-10'){
        $scope.tasklistSize = 'col-xs-5';
        $scope.taskDescript = 'task__details__item';
      }
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
          var item = task.statuses[i];
          FBRef.child('team').child(Phased.user.curTeam).child('statuses').child(item).once('value',function(snap){
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
