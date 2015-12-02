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
    /**
    * ???
    * updates stream?
    * if so, retrofit to only watch own tasks
    */
    $scope.checkStatus = function(){
     var team = $scope.team.name;
     new Firebase(FURL).child('team').child(team).child('task').on('value', function(users) {
     $scope.team.members = [];
       users = users.val();

       if(users){
         var teamUID = Object.keys(users);

            for (var i = 0; i < teamUID.length; i++) {
                $scope.getTeamTasks(teamUID[i], users);
            }
       }

     });
  };

  /**
  *
  * retrofit to getOwnTasks
  * called by checkStatus
  */
  $scope.getTeamTasks = function(memberID, users){
    var userrefs = new Firebase(FURL + 'profile/' + memberID);
    userrefs.once("value", function(data) {
             //console.log(memberID);
      var p = data.val();
             //console.log(p);
      var pic,style;
      if(users[memberID].photo){
        style = "background:url("+users[memberID].photo+") no-repeat center center fixed; -webkit-background-size: cover;-moz-background-size: cover; -o-background-size: cover; background-size: cover";
      } else{
        style = false;
      }
      var teamMember = {
        name : p.name,
        pic : p.gravatar,
        task : users[memberID].name,
        time : users[memberID].time,
        weather:users[memberID].weather,
        city:users[memberID].city,
        uid : memberID,
        photo:style
      };

      $scope.team.members.push(teamMember);
      $scope.$apply();

      });
  }

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
  * retrofit to viewTask
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
  * keep
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

  // fills out the task status types in $scope.taskStatuses
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
  * retrofit to addTask
  */
  $scope.addMembers = function(names){
    ga('send', 'event', 'Team', 'Member added');
    //_gaq.push(['_trackEvent', 'Team', 'Add member']);
  	var ref = new Firebase(FURL);
    // grab all users and see if they match an email in the system
    ref.child('profile').once('value', function(data){
      data = data.val();

      var selectedUID = Object.keys(data);
      var isSet = false;

      // if this email matches the one from the profile page assign this team to their account
      for(var y = 0; y < selectedUID.length; y++){
        console.log('test3');
        if(names.email == data[selectedUID[y]].email){
          isSet = true;
          //get the key of the uid

          //save to new node so that zapier can email.
          ref.child('team-invite-existing-member').push({teams : { 0 : Auth.team},email : names.email, inviteEmail: $scope.currentUser.email, inviteName: $scope.currentUser.name });

          //push new team to member
          ref.child('profile').child(selectedUID[y]).child('teams').push(Auth.team);
          break;
        }
      }
      // if no matches are found create a profile-in-waiting with this team assigned.
      if(!isSet){
        console.log(names.email, $scope.currentUser);

        // loop profile-in-waiting to find a match
        ref.child('profile-in-waiting').once('value', function(data){
          data = data.val();
          var selectedUID = Object.keys(data);
          var thisSet = false;
          for(var y = 0; y < selectedUID.length; y++){
            console.log(data[selectedUID[y]].email);
            if(names.email == data[selectedUID[y]].email){
              thisSet = true;
              //check if email already has team attached
              var userTeams = Object.keys(data[selectedUID[y]].teams);
              var profileOfUser = data[selectedUID[y]];
              var change = false;

              for(var u = 0; u < userTeams.length; u++){
                if(profileOfUser.teams[userTeams[u]] == Auth.team){
                  break;
                }else{
                  change = true;
                  break;
                }
              }
              if(change){
                //push new team to member
                ref.child('profile-in-waiting').child(selectedUID[y]).child('teams').push(Auth.team);
                //sendTheMail(msg);
                break;
              }
            }
          }
          if(!thisSet){
            ref.child('profile-in-waiting').push({teams : { 0 : Auth.team},email : names.email, inviteEmail: $scope.currentUser.email, inviteName: $scope.currentUser.name });
            ref.child('profile-in-waiting2').push({teams : { 0 : Auth.team},email : names.email, inviteEmail: $scope.currentUser.email, inviteName: $scope.currentUser.name });
          }
        });
      }
    });
    $('#myModal').modal('toggle');
  };


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
    var taskPrefix = '';
    var status = {
      name: taskPrefix + newTask.name,
      time: new Date().getTime(),
      user: Auth.user.uid,
      cat : newTask.category ? newTask.category : '',
      city: $scope.city ? $scope.city : 0,
      weather: weather,
      taskPrefix : taskPrefix,
      photo : $scope.bgPhoto ? $scope.bgPhoto : 0,
      location: {
        lat : $scope.lat ? $scope.lat : 0,
        long : $scope.long ? $scope.long : 0
      },
      assignee : newTask.assignee.uid
    };

    // babbys first status
    console.log('status', status);

    return; // tmp

    // push update to db
    var teamRef = new Firebase(FURL),
      team = $scope.team.name;
    teamRef.child('team').child(team).child('task').child(Auth.user.uid).set(status);
    teamRef.child('team').child(team).child('all').child(Auth.user.uid).push(status,function(){
      console.log('status set');
      $scope.updateStatus = '';
      //we are getting the user.uid, we need to extract the member off the user.uid.
      //then we can do a scope.setSelected off that member.

        //Send push notifications to team
      // $http.get('http://45.55.200.34:8080/push/update/'+team+'/'+Auth.user.name+'/'+status.name,'').success(function(data){
      //   //alert(data);
      // });
    });


    //reset scope
    $scope.task = update;
    $scope.task.name = '';

    $scope.showTaskView = true;
    $scope.taskTime = status.time; // we didnt have status.time so i think this fixes the problem(?)
    // maybe we need a timeout function here to run around out $apply()??

    //$scope.$apply();

    //need to find out what the member/who is
    //$scope.getTaskHistory(member);
  }

  $scope.addTaskModal = function(){
    ga('send', 'event', 'Modal', 'Member add');
    $('#myModal').modal('toggle');
  }


  $scope.init = function(){
    var ref = new Firebase(FURL);
    console.log(Auth.user);
    ref.child('profile').child(Auth.user.uid).child('curTeam').once('value',function(data){
      data = data.val();
      $scope.team.name = data;

      $scope.getCategories();
      $scope.getTaskStatuses();
      $scope.checkStatus(); // start stream

    })
  }

  $scope.init();

});
