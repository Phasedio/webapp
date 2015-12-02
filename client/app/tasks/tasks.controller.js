'use strict';

angular.module('webappApp')
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
  * updates stream?
  * if so, retrofit to only watch own tasks
  * 
  * task streams to watch:
  *   - own updates (in progress) 
  */
  $scope.checkStatus = function(){
    var team = $scope.team.name;
    new Firebase(FURL).child('team').child(team).child('task').on('value', function(users) {
      $scope.team.members = [];
      users = users.val();

      if (users) {
        var teamUID = Object.keys(users);
        for (var i = 0; i < teamUID.length; i++) {
          $scope.getUserDetails(teamUID[i], users);
        }

        // ugly debounce to get around having to wait for multiple callbacks
        var interval = window.setInterval(function() { 
          if ($scope.team.members && $scope.team.members[$scope.myID]) {
            window.clearInterval(interval);
            $scope.setWatchAssignments();
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
  $scope.setWatchAssignments = function() {
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
    if (!thisMember.watched) {
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
  * called by checkStatus
  */
  $scope.getUserDetails = function(memberID, users){
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

  // gets history for a user
  $scope.getHistory = function(uid){
    var ref = new Firebase(FURL);
    ref.child('team').child($scope.team.name).child('all').child(uid).once('value',function(data){
      data = data.val();
      $http.post('../api/downloads', {hose:data}).success(function(data){
        console.log(data);
        window.open('../api/downloads/'+data);
      });
    });
  }



  /**
  *
  * retrofit to viewTask?
  */
  $scope.viewUser = function(user){
    ga('send', 'event', 'Team', 'View user');
    $scope.showMember = true;
    console.log(user);
    $scope.selectedUser = {
      name : user.name,
      gravatar : user.pic,
      uid : user.uid,
      history: []
    };

    var ref = new Firebase(FURL);
    var startTime = new Date().getTime();
    var endTime = startTime - 86400000;
    console.log(startTime);


    ref.child('team').child($scope.team.name).child('all').child(user.uid).orderByChild('time').startAt(endTime).once('value',function(data){
      data = data.val();
      console.log(data);
      var keys = Object.keys(data);
      for(var i = 0; i < keys.length; i++){
        $scope.selectedUser.history.push(data[keys[i]]);
      }

      $scope.$apply();
    });
  }

  /**
  *
  * fills out $scope.team.categories
  * called in $scope.init()
  */
  $scope.getCategories = function(){
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

  $scope.getTaskStatuses = function() {
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
          { name : 'Assigned'  }
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


    return;

    //reset current task in feed
    // (all old stuff)
    $scope.task = update;
    $scope.task.name = '';

    $scope.showTaskView = true;
    $scope.taskTime = status.time; 
  }

  /**
  * pop open add task modal
  */
  $scope.addTaskModal = function(){
    ga('send', 'event', 'Modal', 'Task add');
    $('#myModal').modal('toggle');
  }


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

      $scope.getCategories();
      $scope.getTaskStatuses();
      $scope.checkStatus(); // start stream
      // $scope.setWatchAssignments(); // now called from checkStatus to be in sequence

    })
  }

  $scope.init();

});
