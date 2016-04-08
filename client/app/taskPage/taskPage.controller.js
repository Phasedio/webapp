'use strict';

angular.module('webappApp')
  .controller('TaskPageCtrl', function ($scope, $http, Auth, Phased, FURL,amMoment,toaster,uiCalendarConfig,$routeParams,$location) {
    $scope.message = 'Hello';


    $scope.phased = Phased;
    $scope.team = Phased.team;
    $scope.assignments = Phased.get.tasks;
    $scope.archive = Phased.archive;
    $scope.taskInfo = {}; // Task information for the description area
    $scope.today = new Date().getTime(); // min date for deadline datepicker
    $scope.eventSources = [];//needed for the calendar
    $scope.taskPriorities = Phased.TASK_PRIORITIES; // in new task modal
    $scope.taskStatuses = Phased.TASK_STATUSES; // in new task modal
    $scope.taskPriorityID = Phased.TASK_PRIORITY_ID;
    $scope.taskStatusID = Phased.TASK_STATUS_ID;
    $scope.taskHistType = Phased.TASK_HISTORY_CHANGES;
    $scope.myID = Auth.user.uid;
    $scope.edit = false;


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

    function init() {
      // get route param and try to assign it
      if (Phased.PROJECTS_SET_UP) {
        $scope.taskInfo = Phased.get.tasks[$routeParams.taskID]; // easy / lite syntax (same object reference)
        getStatuses($scope.taskInfo);
      } else {
				// If this was deep linked to then wait for the provider to get set up
				$scope.$on('Phased:projectsComplete', init);
      }
    }
    init();


    //grabs any statuses that are on the task
    function getStatuses(task){
      if (task) {
        $scope.taskStatuses = $scope.taskStatuses || [];
        for (var i in task.statuses) {
          if (task.statuses.hasOwnProperty(i)) {
            console.log(i);
            var item = task.statuses[i];
            FBRef.child('team').child(Phased.user.curTeam).child('statuses').child(item).once('value',function(snap){
              console.log(snap.val());
              $scope.taskStatuses.push(snap.val());
            });
          }
        }
      }

    }
    $scope.editMode = function(){
      if ($scope.edit) {
        $scope.edit = false;
      }else{
        $scope.edit = true;
      }
    }
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
      mixpanel.track("Broadcast Task");
      console.log(task);
      Phased.activateTask(task.key, task, "Is working on task: ");
      toaster.pop('success', "Success!", "Your task was posted");
    }

    // Edit name
    $scope.taskEditName = function(taskID, newName) {
      var taskID = $routeParams.taskID;
      Phased.setTaskName(taskID, newName);
    }

    // edit description
    $scope.taskEditDesc = function(taskID, desc) {
      var taskID = $routeParams.taskID;
      Phased.setTaskDesc(taskID, desc);
    }

    // Edit assigned user
    $scope.taskEditAssigned = function(taskObj, userID) {
      var taskID = $routeParams.taskID;
      Phased.setTaskAssignee(taskObj, userID);
    }
    // Edits date of deadline or clears it
    $scope.taskEditDate = function(taskID, date) {
      var taskID = $routeParams.taskID;
      Phased.setTaskDeadline(taskID, date);
    }

    // change category
    $scope.changeCategory = function(taskID, catKey) {
      var taskID = $routeParams.taskID;
      Phased.setTaskCategory(taskID, catKey);
    }
    // change priority
    $scope.changePriority = function(taskID, priorityKey) {
      var taskID = $routeParams.taskID;
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
    console.log('test');
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





  });
