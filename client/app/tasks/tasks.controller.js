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
  .controller('TasksCtrl', function ($scope, $http, stripe, Auth, Phased, FURL,amMoment,toaster) {
    ga('send', 'pageview', '/tasks');

    $scope.team = Phased.team;
    $scope.viewType = Phased.viewType;
    $scope.taskPriorities = Phased.TASK_PRIORITIES; // in new task modal
    $scope.taskStatuses = Phased.TASK_STATUSES; // in new task modal
    $scope.taskPriorityID = Phased.TASK_PRIORITY_ID;
    $scope.taskStatusID = Phased.TASK_STATUS_ID;
    $scope.myID = Auth.user.uid;

    $scope.today = new Date().getTime(); // min date for deadline datepicker

    $scope.assignments = Phased.assignments;
    $scope.archive = Phased.archive;
    $scope.showArchive = false;

    $scope.activeStream = $scope.assignments.to_me;
    $scope.activeFilter = '!1'; // not completed tasks

    $scope.sortable = [
      'cat', 'deadline', 'priority', 'name', 'date', 'assigned_by'
    ];

    /**
    *
    *   ~*~ init ~*~
    *
    */

    // tell Phased to watch assignments
    Phased.watchAssignments();

    /**
    **
    **  event handlers
    **
    */

    // validates stream and filter, then sets active task stream
    // optionally gets archive if not present
    $scope.setActiveStream = function(streamName, filter) {
      console.log('setting active stream', streamName, filter);
      // check and set status
      switch (streamName) {
        case 'assignments.all':
          $scope.activeStream = $scope.assignments.all;
          break;
        case 'assignments.to_me':
          $scope.activeStream = $scope.assignments.to_me;
          break;
        case 'assignments.by_me':
          $scope.activeStream = $scope.assignments.by_me;
          break;
        case 'assignments.unassigned':
          $scope.activeStream = $scope.assignments.unassigned;
          break;
        case 'archive.to_me':
          if (!('to_me' in $scope.archive)) Phased.getArchiveFor('to_me');
          $scope.activeStream = $scope.archive.to_me;
          console.log('arch', $scope.archive);
          break;
        case 'archive.all':
          Phased.getArchiveFor('all');
          $scope.activeStream = $scope.archive.all;
          console.log('arch', $scope.archive);
          break;
        default:
          console.log('switch default');
          $scope.activeStream = $scope.assignments.to_me;
          filter = '!' + Phased.TASK_STATUS_ID.COMPLETE;
          break;
      }

      // check and set filter
      if (!filter || typeof filter == 'undefined') {
        $scope.activeFilter = undefined;
      } else {
        filter = filter.toString();

        // check for negating character
        var filterNot = false;
        if (filter[0] === '!') {
          filterNot = true;
          filter.slice(1);
        }

        // default to 'not COMPLETE' on false
        if (!(filter in Phased.TASK_STATUSES)) {
          filter = '1';
          filterNot = true;
        }

        // set activeFilter
        $scope.activeFilter = filterNot ? '!' + filter : filter;
      }

      console.log('active stream set:', $scope.activeStream, $scope.activeFilter);
    }

    $scope.addTask = function(newTask){
      // incoming object
      // console.log('newTask', newTask);

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
      Phased.addTask(status);

      //reset current task in feed
      $('#myModal').modal('toggle');
      $scope.newTask = {};
    }

    $scope.activateTask = Phased.activateTask;

    $scope.takeTask = Phased.takeTask;

    $scope.moveToArchive = Phased.moveToFromArchive;

    $scope.moveFromArchive = function(assignmentID) {
      Phased.moveToFromArchive(assignmentID, true);
    }

    // gets archived tasks at address shows archive
    $scope.getArchiveFor = function(address) {
      Phased.getArchiveFor(address);
      $scope.showArchive = true;
    }

    $scope.setTaskCompleted = function(assignmentID) {
      Phased.setAssignmentStatus(assignmentID, Phased.TASK_STATUS_ID.COMPLETE);
    }

    /**
    * pop open add task modal
    */
    $scope.addTaskModal = function(){
      ga('send', 'event', 'Modal', 'Task add');
      $('#myModal').modal('toggle');
    }

});
