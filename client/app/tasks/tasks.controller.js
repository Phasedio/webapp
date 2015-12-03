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
    $scope.showMember = false;
    $scope.team = {
      name : '',
      members : {},
      history : [],
      categorySelect : [],
      categoryObj : {}
    };
    $scope.taskStatuses = {};
    $scope.viewType = 'notPaid';

    $scope.selectedUser = {
        name : '',
        gravatar : '',
        uid : '',
        history: []
      };
    $scope.myID = Auth.user.uid;


    /**
    *
    *   ~*~ $scope.init ~*~
    *
    */
    $scope.init = function(){
      var ref = new Firebase(FURL);
      ref.child('profile').child(Auth.user.uid).child('curTeam').once('value',function(data){
        data = data.val();
        $scope.team.name = data;

        getCategories();
        getTaskStatuses();
        checkStatus(); // start stream
        // $scope.setWatchAssignments(); // now called from checkStatus to be in sequence

      })
    }

    $scope.init();


    /**
    **
    **  ~*~ setup functions ~*~
    **
    */

    /**
    * 
    * updates stream?
    * if so, retrofit to only watch own tasks
    * 
    * task streams to watch:
    *   - own updates (in progress) 
    */
    var checkStatus = function(){
      var team = $scope.team.name;
      new Firebase(FURL).child('team').child(team).child('task').on('value', function(users) {
        $scope.team.members = [];
        users = users.val();

        if (users) {
          var teamUID = Object.keys(users);
          for (var i = 0; i < teamUID.length; i++) {
            getUserDetails(teamUID[i], users);
          }

          // ugly debounce to get around having to wait for multiple callbacks
          var interval = window.setInterval(function() { 
            if ($scope.team.members && $scope.team.members[$scope.myID]) {
              window.clearInterval(interval);
              setWatchAssignments();
            }
          }, 100);
        }
      });
    };


    /**
    *
    * sets up watchers for current users task assignments - to and by
    *
    *   - own assignments (to self or to others) all/(me)/assigned_by_me
    *   - assignments to me by others all/(me)/assigned_to_me
    */
    var setWatchAssignments = function() {
      var allRef = new Firebase(FURL).child('team/' + $scope.team.name + '/all');
    
      // collection of assigned_to_me collections to keep up to date
      $scope.watched = [];
      
      // watch own
      watchMember($scope.myID, allRef);

      // check others to watch
      allRef.child(Auth.user.uid + '/assigned_by_me').on('value', function(data) {
        data = data.val();

        for (var i in data) {
          watchMember(data[i].user, allRef);
        }
      });
    }

    /**
    *
    * sets watchers for others, allowing changes to be pushed
    *
    * 1. check if a watcher is already set (ie, user.watched == true)
    * 2. if not, immediately set user.watched, then set up watcher
    * 3. watcher simply keeps member.assigned_to_me up to date
    *
    */
    var watchMember = function(memberID, allRef) {
      var thisMember = $scope.team.members[memberID];

      // 1
      if (thisMember && !thisMember.watched) {
        // 2
        thisMember.watched = true;
        $scope.watched.push(thisMember);

        allRef.child(memberID + '/assigned_to_me').on('value', function(data) {
          // 3
          thisMember.assigned_to_me = data.val();
        });
      }
    }

    /**
    *
    * fills out $scope.team.members details
    * called by checkStatus
    */
    var getUserDetails = function(memberID, users){
      var userrefs = new Firebase(FURL + 'profile/' + memberID);
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
    * called in $scope.init()
    */
    var getCategories = function(){
      var team = $scope.team.name;
      new Firebase(FURL).child('team').child(team).child('category').once('value', function(cat) {
        cat = cat.val();
        console.log('cat', cat);
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
            console.log('team', $scope.team);
        }else{
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
          new Firebase(FURL).child('team').child(team).child('category').set(obj);
          new Firebase(FURL).child('team').child(team).child('category').once('value', function(cat) {
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
    * called in $scope.init()
    */

    var getTaskStatuses = function() {
      new Firebase(FURL).child('taskStatuses').once('value', function(tS /*taskStatuses*/ ) {
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
          new Firebase(FURL).child('taskStatuses').set(obj);
          // get data from db to ensure synchronicity
          new Firebase(FURL).child('taskStatuses').once('value', function(tS /*taskStatuses*/ ) {
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
      ga('send', 'event', 'task', 'task added');

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
        user: newTask.assignee.uid,
        cat : newTask.category ? newTask.category : '',
        city: $scope.city ? $scope.city : 0,
        weather: weather,
        taskPrefix : taskPrefix,
        photo : $scope.bgPhoto ? $scope.bgPhoto : 0,
        location: {
          lat : $scope.lat ? $scope.lat : 0,
          long : $scope.long ? $scope.long : 0
        },
        assigned_by : Auth.user.uid,
        status: 2 // "Assigned", there should be a more elegant way to set this
      };

      // babbys first status
      console.log('status', status);

      // return; // tmp

      // push new task to db

      // 1. add task to team/(teamname)/all/(newTask.assignee.uid)/assigned_to_me
      // 2. add reference { (task_id) : (assignee_id) } to team/(teamname)/all/(Auth.user)/assigned_by_me

      var teamRef = new Firebase(FURL),
        team = $scope.team.name,
        all = teamRef.child('team').child(team).child('all');

      // 1
      var newTaskRef = all.child(newTask.assignee.uid).child('assigned_to_me').push(status);

      // 2
      var assignmentReference = {
        user : newTask.assignee.uid,
        task: newTaskRef.key()
      }
      all.child(Auth.user.uid).child('assigned_by_me').push(assignmentReference);

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

      // copy task so we don't damage the original assignment
      var task = angular.copy(assignment);

      // update time to now and place to here (feature pending)
      task.time = new Date().getTime();
      task.lat = $scope.lat ? $scope.lat : 0;
      task.long = $scope.long ? $scope.long : 0;

      // delete attrs not used by feed
      delete task.status;
      delete task.assigned_by;

      console.log('activating task', task, assignment);
      // return;

      // update original assignment status to In Progress (0)
      setAssignmentStatus(assignmentID, 0);

      // publish to stream
      var ref = new Firebase(FURL).child('team/' + $scope.team.name);
      ref.child('task/' + Auth.user.uid).set(task);
      ref.child('all/' + Auth.user.uid).push(task, function() {
        console.log('status update complete');
      });
    }


    /**
    *
    * sets assignment status to Complete (1)
    */
    $scope.setTaskCompleted = function(assignment, assignmentID) {
      ga('send', 'event', 'Task', 'completed');
      setAssignmentStatus(assignmentID, 1);
    }


    /**
    *
    * convenience function to set an assignment's status
    * defaults to current user
    * fails if newStatus isn't valid
    */
    var setAssignmentStatus = function(assignmentID, newStatus, userID) {
      userID = userID ? userID : $scope.myID; // default to me

      if (!(newStatus in $scope.taskStatuses)) {
        console.log(newStatus + ' is not a valid status ID');
        return;
      }

      // push to database
      var ref = new Firebase(FURL).child('team/' + $scope.team.name);
      ref.child('all/' + userID + '/assigned_to_me/' + assignmentID + '/status').set(newStatus);
    }

    /**
    * pop open add task modal
    */
    $scope.addTaskModal = function(){
      ga('send', 'event', 'Modal', 'Task add');
      $('#myModal').modal('toggle');
    }

});
