'use strict';

angular.module('webappApp')
  .controller('TaskPageCtrl', function ($scope, $http, stripe, Auth, Phased, FURL,amMoment,toaster,uiCalendarConfig,$routeParams,$location) {
    $scope.message = 'Hello';


    $scope.phased = Phased;
    $scope.team = Phased.team;
    $scope.assignments = Phased.assignments;
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

    function init(){
      // get route peram and try to assign it
      console.log($scope.assignments);
      //check if phased is set up
      // if(Phased.assignments){
      //   if($routeParams.taskID && Phased.assignments.all[$routeParams.taskID]){
      //     $scope.taskInfo = Phased.assignments.all[$routeParams.taskID];
      //     console.log($scope.taskInfo);
      //
      //   }else{
      //     //fail - send user to tasks page
      //     //alert("failed")
      //     //$location.path("/tasks")
      //   }
      // }
      if(Phased.SET_UP){
        $scope.taskInfo = Phased.team.projects[$routeParams.project].columns[$routeParams.column].cards[$routeParams.card].tasks[$routeParams.taskID];
        getStatuses($scope.taskInfo);
      }

    }

    // If this was deep linked to then wait for the provider to get set up
    $scope.$on('Phased:setup', function() {

      // if($routeParams.taskID && Phased.assignments.all[$routeParams.taskID]){
      //   $scope.taskInfo = Phased.assignments.all[$routeParams.taskID];
      //   console.log($scope.taskInfo);
      //
      // }else{
      //   //fail - send user to tasks page
      //   alert("failed")
      //   //$location.path("/tasks")
      // }
      init();
      $scope.$apply();
    });


    init();


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





  });
