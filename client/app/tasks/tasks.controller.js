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
    $scope.taskPriorities = Phased.TASK_PRIORITIES;
    $scope.taskStatuses = Phased.TASK_STATUSES;
    $scope.myID = Auth.user.uid;

    $scope.today = new Date().getTime();

    $scope.assignments = Phased.assignments;
    $scope.archive = Phased.archive;
    $scope.showArchive = false;

    $scope.sortable = [
      'cat', 'deadline', 'priority', 'name', 'date', 'assigned_by'
    ]

    var FBRef = Phased.FBRef;

    /**
    *
    *   ~*~ init ~*~
    *
    */

    // tell Phased to watch assignments
    Phased.watchAssignments();

    /**
    **
    **  ~*~ setup functions ~*~
    **
    */

    $scope.moveToArchive = function(assignmentID) {
      Phased.moveToFromArchive(assignmentID);
    }

    $scope.moveFromArchive = function(assignmentID) {
      Phased.moveToFromArchive(assignmentID, true);
    }

    // gets archived tasks at address shows archive
    $scope.getArchiveFor = function(address) {
      Phased.getArchiveFor(address);
      $scope.showArchive = true;
    }

    /**
    **
    **  event handlers and convenience functions
    **
    */

    /**
    *
    * assigns new task to a user, possibly self
    *
    * 1. check input / format input
    * 2. push to db
    * 3. reset modal
    *
    */
    $scope.addTask = function(newTask){
      ga('send', 'event', 'Task', 'task added');

      // incoming object
      console.log('newTask', newTask);

      // check form errors
      // if($scope.taskForm.$error.maxlength) {
      //   alert('Your update is too long!');
      //   return;
      // }


      // format object to send to db
      var taskPrefix = '',
        weather = '';
      var status = {
        name: taskPrefix + newTask.name,
        time: new Date().getTime(),
        // user: newTask.assignee.uid,
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

      // babbys first status
      console.log('status', status);

      // return; // tmp

      // push new task to db

      // 1. add task to team/(teamname)/assignments/all
      // 2. add references to /to/assignee or /unassigned and /by/me

      var team = $scope.team.name,
        assignments = FBRef.child('team/' + team + '/assignments');

      // 1
      var newTaskRef = assignments.child('all').push(status);
      var newTaskID = newTaskRef.key();
      // 2
      // var assignmentReference = {
      //   user : newTask.assignee.uid,
      //   task: newTaskRef.key()
      // }
      assignmentIDs['by_me'].push(newTaskID);
      assignments.child('by/' + Auth.user.uid).set(assignmentIDs['by_me']);

      // get array, push (array style), send back to server
      var path = newTask.unassigned ? 'unassigned' : 'to/' + newTask.assignee.uid;
      assignments.child(path).once('value', function(data) {
        data = data.val();
        data = data || [];
        data.push(newTaskID);
        assignments.child(path).set(data);
      });

      //reset current task in feed
      $('#myModal').modal('toggle');
      $scope.newTask = {};
    }

    /**
    *
    * sets an assigned task to the user's active task
    * and sets status of that task to "In Progress" (0)
    *
    */
    $scope.activateTask = function(assignment, assignmentID) {
      ga('send', 'event', 'Update', 'submitted');
      ga('send', 'event', 'Task', 'activated');

      // copy task so we don't damage the original assignment
      var task = angular.copy(assignment);

      // update time to now and place to here (feature pending)
      task.time = new Date().getTime();
      task.lat = $scope.lat ? $scope.lat : 0;
      task.long = $scope.long ? $scope.long : 0;

      // in case of unassigned tasks, which don't have a user property
      task.user = $scope.myID;

      // delete attrs not used by feed
      delete task.status;
      delete task.assigned_by;

      console.log('activating task', task, assignment);
      // return;

      // update original assignment status to In Progress
      setAssignmentStatus(assignmentID, Phased.TASK_STATUS_ID.IN_PROGRESS);

      // publish to stream
      var ref = FBRef.child('team/' + $scope.team.name);
      ref.child('task/' + Auth.user.uid).set(task);
      ref.child('all/' + Auth.user.uid).push(task, function() {
        console.log('status update complete');
      });
    }

    /**
    *
    * moves a task from /unassigned into /to/(me)
    * without touching status
    *
    */
    $scope.takeTask = function(assignmentID) {
      ga('send', 'event', 'Task', 'task taken');
      var assignmentsPath = 'team/' + $scope.team.name + '/assignments/';

      // 1. remove task from /unassigned
      delete assignmentIDs.unassigned[assignmentIDs.unassigned.indexOf(assignmentID)];
      FBRef.child(assignmentsPath + 'unassigned').set(assignmentIDs.unassigned);

      // 2. add task to /to/(me)
      assignmentIDs.to_me.push(assignmentID);
      FBRef.child(assignmentsPath + 'to/' + $scope.myID ).set(assignmentIDs.to_me);

      // 3. set user attr
      FBRef.child(assignmentsPath + 'all/' + assignmentID + '/user').set($scope.myID);
    }


    /**
    *
    * sets assignment status to Complete
    */
    $scope.setTaskCompleted = function(assignmentID) {
      ga('send', 'event', 'Task', 'completed');
      setAssignmentStatus(assignmentID, Phased.TASK_STATUS_ID.COMPLETE);
    }


    /**
    *
    * convenience function to set an assignment's status
    * fails if newStatus isn't valid
    */
    var setAssignmentStatus = function(assignmentID, newStatus) {
      if (!(newStatus in $scope.taskStatuses)) { // not a valid ID
        var i = $scope.taskStatuses.indexOf(newStatus);
        if (i !== -1) {
          console.log(newStatus + ' is a valid status name');
          newStatus = i;
        } else {
          console.log('err: ' + newStatus + ' is not a valid status name or ID');
          return;
        }
      }

      // push to database
      FBRef.child('team/' + $scope.team.name + '/assignments/all/' + assignmentID + '/status').set(newStatus);
    }

    /**
    *
    * convenience functionto set an assignment's priority
    * fails if new priority isn't valid
    */
    var setAssignmentPriority = function(assignmentID, newPriority) {
      console.log('setAssignmentPriority');

      if (!(newPriority in $scope.taskPriorities)) { // not a valid ID
        var i = $scope.taskPriorities.indexOf(newPriority);
        if (i !== -1) {
          console.log(newPriority + ' is a valid status name');
          newPriority = i;
        } else {
          console.log('err: ' + newPriority + ' is not a valid status name or ID');
          return;
        }
      }

      // push to database
      FBRef.child('team/' + $scope.team.name + '/assignments/all/' + assignmentID + '/priority').set(newPriority);
    }

    /**
    *
    * convenience function for removing an item from an array
    * returns the new array
    *
    */
    var popFromList = function(item, list) {
      var i = list.indexOf(item);
      while (i > -1) {
        delete list[i];
        i = list.indexOf(item);
      }
      return list;
    }

    // convert object into array
    // useful for arrays with missing keys
    // eg, [0 = '', 1 = '', 3 = ''];
    var objToArray = function(obj) {
      var newArray = [];
      for (var i in obj) {
        newArray.push(obj[i]);
      }
      return newArray;
    }

    /**
    * pop open add task modal
    */
    $scope.addTaskModal = function(){
      ga('send', 'event', 'Modal', 'Task add');
      $('#myModal').modal('toggle');
    }

});
