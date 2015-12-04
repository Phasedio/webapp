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
  .controller('TasksCtrl', function ($scope, $http, stripe, Auth, FURL,amMoment,toaster) {
    ga('send', 'pageview', '/tasks');
    $scope.team = {
      name : '',
      members : {},
      history : [],
      categorySelect : [],
      categoryObj : {}
    };
    $scope.taskStatuses = {};
    $scope.viewType = 'notPaid';
    $scope.myID = Auth.user.uid;
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

    $scope.assignments = {
      all : {}, // all of the team's assignments
      to_me : {}, // assigned to me (reference to objects in all)
      by_me : {}, // assigned by me (reference to objects in all)
      unassigned : {} // unassigned (reference to objects in all)
    }
    // lists of assignment IDs used internally
    // set by updateAssignedTo(), etc
    var assignmentIDs = {
      to_me : [],
      by_me : [],
      unassigned : []
    }

    /**
    *
    *   ~*~ init ~*~
    *
    */
    var init = function(){
      FBRef.child('profile').child(Auth.user.uid).child('curTeam').once('value',function(data){
        data = data.val();
        $scope.team.name = data;

        // get metadata
        getCategories();
        getTaskStatuses();
        getTaskPriorities();

        // start streaming
        startStream();
        setWatchAssignments();

      })
    }

    init();


    /**
    **
    **  ~*~ setup functions ~*~
    **
    */

    /**
    * 
    * starts the data stream 
    * 1. watches the team's tasks
    * 1.b  when a new task is posted, it refreshes the team membership
    *
    */
    var startStream = function() {
      // 1.
      var team = $scope.team.name;
      FBRef.child('team').child(team).child('task').on('value', function(users) {
        $scope.team.members = [];
        users = users.val();

        if (users) {
          // 1.b
          var teamUID = Object.keys(users);
          for (var i = 0; i < teamUID.length; i++) {
            getUserDetails(teamUID[i], users);
          }
        }
      });
    };


    /**
    *
    * sets up watchers for current users task assignments - to and by
    * and also unassigned tasks
    *
    *   - own assignments (to self or to others) assignments/to/(me)
    *   - assignments to me by others assignments/by/(me)
    *   - unassigned tasks assignments/un
    */
    var setWatchAssignments = function() {
      var refString = 'team/' + $scope.team.name + '/assignments';

      FBRef.child(refString + '/all').on('value', updateAllAssignments);
      FBRef.child(refString + '/to/' + Auth.user.uid).on('value', updateAssignedTo);
      FBRef.child(refString + '/by/' + Auth.user.uid).on('value', updateAssignedBy);
      FBRef.child(refString + '/unassigned').on('value', updateUnassigned);
    }

    /**
    *
    * STUB
    * updates $scope.assignments.all
    *
    * instead of replacing the whole object, compares assignments and props, then updates
    * allowing for persistent references throughout the app
    *
    */
    var updateAllAssignments = function(data) {
      data = data.val();
      if (!data) {
        $scope.assignments.all = {};
        return;
      }
      var all = $scope.assignments.all;

      // 1. if assignment doesn't exist in all, add it, end of story
      // 2. else, check its properties and update those that are out of sync
      // (i is the assignment uid)
      for (var i in data) {
        if (!(i in all)) {
          // 1.
          all[i] = data[i];

        } else {
          // 2.
          // a. sync extant properties in all, delete those no longer in data
          // b. add new properties from data
          // (j is property name)

          for (var j in all[i]) {
            // a.
            if (j in data[i]) {
              all[i][j] = data[i][j];
            } else {
              delete all[i][j];
            }
          }

          for (var j in data[i]) {
            // b.
            if (!(j in all[i])) {
              all[i][j] = data[i][j];
            }
          }

        }
      } // for var i in data

      // if assignment isn't in data, delete it
      for (var i in all) {
        if (!(i in data)) {
          delete all[i];
        }
      }

      // sync all containers
      for (var i in assignmentIDs) {
        syncAssignments(i);
      }

      console.log($scope.assignments);
    } // updateAllAssignments()

    /**
    *
    * updates $scope.assignedTo
    *
    */
    var updateAssignedTo = function(data) {
      data = data.val();
      assignmentIDs['to_me'] = data || [];
      syncAssignments('to_me');
    }

    /**
    *
    * updates $scope.assignedBy
    *
    */
    var updateAssignedBy = function(data) {
      data = data.val();
      assignmentIDs['by_me'] = data || [];
      syncAssignments('by_me');
    }

    /**
    *
    * updates $scope.unassigned
    *
    */
    var updateUnassigned = function(data) {
      data = data.val();
      assignmentIDs['unassigned'] = data || [];
      syncAssignments('unassigned');
    }

    /**
    *
    * syncs assignments (in assignments.all) listed in the UIDContainer to the assignmentContainer
    *
    */
    var syncAssignments = function(assignmentContainerName) {
      var assignmentContainer = {},
        UIDContainer = assignmentIDs[assignmentContainerName];

      for (var i in UIDContainer) {
        var assignmentID = UIDContainer[i];
        if (assignmentID in $scope.assignments.all)
          assignmentContainer[assignmentID] = $scope.assignments.all[assignmentID];
      }

      $scope.assignments[assignmentContainerName] = assignmentContainer;
    }

    /**
    *
    * fills out $scope.team.members details
    * called by startStream
    */
    var getUserDetails = function(memberID, users){
      var userrefs = FBRef.child('profile/' + memberID);
      userrefs.once("value", function(data) {
               //console.log(memberID);
        var p = data.val();
               //console.log(p);
        var pic,style;
        if (users[memberID].photo){
          style = "background:url("+users[memberID].photo+") no-repeat center center fixed; -webkit-background-size: cover;-moz-background-size: cover; -o-background-size: cover; background-size: cover";
        } else {
          style = false;
        }
        var teamMember = {
          name : p.name,
          pic : p.gravatar,
          task : users[memberID].name,
          time : users[memberID].time,
          weather: users[memberID].weather,
          city: users[memberID].city,
          uid : memberID,
          photo: style
        };

        $scope.team.members[memberID] = teamMember;
        $scope.$apply();

      });
    }


    /**
    *
    * fills out $scope.team.categories
    * called in init()
    */
    var getCategories = function(){
      var team = $scope.team.name;
      FBRef.child('team').child(team).child('category').once('value', function(cat) {
        cat = cat.val();
        if(typeof cat !== 'undefined' && cat != null){
          var keys = Object.keys(cat);
          $scope.team.categoryObj = cat;
            for (var i = 0; i < keys.length; i++){
              var obj = {
                name : cat[keys[i]].name,
                color : cat[keys[i]].color,
                key : keys[i]
              }
              $scope.team.categorySelect.push(obj);
            }
        } else {
          //they have no categories so add them
          var obj = [
            {
              name : 'Communication',
              color : '#ffcc00'
            },
            {
              name : 'Planning',
              color : '#5ac8fb'
            }
          ];
          FBRef.child('team/' + team + '/category').set(obj);
          FBRef.child('team/' + team + '/category').once('value', function(cat) {
            cat = cat.val();
            var keys = Object.keys(cat);
            $scope.team.categoryObj = cat;
              for(var i = 0; i < keys.length; i++){
                var obj = {
                  name : cat[keys[i]].name,
                  color : cat[keys[i]].color,
                  key : keys[i]
                }
                  $scope.team.categorySelect.push(obj);
              }
              console.log($scope.team);
          });
        }
      });
    };

    /**
    *
    * fills out the task status types in $scope.taskStatuses
    * called in init()
    */

    var getTaskStatuses = function() {
      FBRef.child('taskStatuses').once('value', function(tS /*taskStatuses*/ ) {
        tS = tS.val();
        // console.log('taskStatuses', tS);
        if (typeof tS !== 'undefined' && tS != null){
          // assign keys to obj, set obj to $scope
          for (var i in tS) {
            tS[i]['key'] = i;
          }
          $scope.taskStatuses = tS;
          // console.log('$scope.taskStatuses', $scope.taskStatuses);
        } else {
          // no status types exist, add defaults
          var obj = [
            { name : 'In Progress' },
            { name : 'Complete' },
            { name : 'Assigned' }
          ];

           // save to db
          FBRef.child('taskStatuses').set(obj);
          // get data from db to ensure synchronicity
          FBRef.child('taskStatuses').once('value', function(tS /*taskStatuses*/ ) {
            tS = tS.val();
            // assign keys to obj and set to $scope
            for (var i in tS) {
              tS[i]['key'] = i;
            }
            $scope.taskStatuses = tS;
            // console.log('$scope.taskStatuses', $scope.taskStatuses);
          });
        }
      });
    }


    /**
    *
    * fills out the task priority types in $scope.taskPriorities
    * called in init()
    */
    var getTaskPriorities = function() {
      FBRef.child('taskPriorities').once('value', function(tP /*taskPriorities*/ ) {
        tP = tP.val();
        // console.log('taskPriorities', tP);
        if (typeof tP !== 'undefined' && tP != null){
          // assign keys to obj, set obj to $scope
          for (var i in tP) {
            tP[i]['key'] = i;
          }
          $scope.taskPriorities = tP;
        } else {
          // no status priorities exist, add defaults
          var obj = [
            { name : 'High' },
            { name : 'Medium' },
            { name : 'Low' }
          ];

          // save to db
          FBRef.child('taskPriorities').set(obj);
          // get data from db to ensure synchronicity
          FBRef.child('taskPriorities').once('value', function(tP /*taskPriorities*/ ) {
            tP = tP.val();
            // assign keys to obj and set to $scope
            for (var i in tP) {
              tP[i]['key'] = i;
            }
            $scope.taskPriorities = tP;
            // console.log('$scope.taskPriorities', $scope.taskPriorities);
          });

          console.log('priorities set', $scope.taskPriorities);
        }
      });
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
        status: StatusID.ASSIGNED,
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
      setAssignmentStatus(assignmentID, StatusID.IN_PROGRESS);

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
      setAssignmentStatus(assignmentID, StatusID.COMPLETE);
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
    * pop open add task modal
    */
    $scope.addTaskModal = function(){
      ga('send', 'event', 'Modal', 'Task add');
      $('#myModal').modal('toggle');
    }

});
