'use strict';
angular.module('webappApp')
  .filter('orderMembersPlus', function orderMembers(Phased) {
    return function(items, field, reverse) {
      var filtered = [];
      for (var i in items) {
        items[i].key = i;
        if (items[i].currentStatusID) {
          if(Phased.team.statuses[items[i].currentStatusID]){
            items[i].lastUpdated = Phased.team.statuses[items[i].currentStatusID].time;
          }
        }else if (items[i].currentStatus) {
          items[i].lastUpdated = items[i].currentStatus.time;
        }else{
          items[i].lastUpdated = 0;
        }


        filtered.push(items[i]);
      }
      filtered.sort(function (a, b) {
        return (a[field] > b[field] ? 1 : -1);
      });
      if(reverse) filtered.reverse();
      return filtered;
    };
  })
  .controller('FeedCtrl', function feedCtrl($scope, $http, Auth, Phased, FURL, amMoment, $location, toaster, $route, $window) {
    ga('send', 'pageview', '/feed');
    $scope.thisP = Phased.PRESENCE;
    $scope.selectedCategory = '';
    $scope.showExtras = false;
    $scope.viewType = Phased.viewType;
    $scope.myID = Auth.user.uid;
    $scope.team = Phased.team;
    $scope.activeStream = Phased.assignments.to_me;
    $scope.activeStatusFilter = '!1'; // not completed tasks
    $scope.taskPriorities = Phased.task.PRIORITY; // in new task modal
    $scope.taskStatuses = []; // in new task modal
    $scope.taskPriorityID = Phased.task.PRIORITY_ID;
    $scope.taskStatusID = Phased.task.STATUS_ID;
    $scope.meta = {
    	status : Phased.status
    }
    $scope.user = Phased.user;
    $scope.deleteHolder = '';
    $scope.editHolder = '';
    $scope.atTop = true;

    $scope.$on('Phased:setup', function() {
      if (!Phased.team.uid) {
        $location.path('/onboarding');
      }
    });

    $scope.$on('Phased:meta', function(){
      if (!Phased.team.uid) {
        $location.path('/onboarding');
      }
    });

		angular.element($window).bind('scroll', _.debounce(function scrollHandler() {
    	$scope.atTop = $window.pageYOffset < 100;
    	$scope.$digest();
    }, 200));

    //bootstrap opt-in func;
    //angular.element($('[data-toggle="tooltip"]')).tooltip();


    $scope.$on('Phased:changedStatus', function(){
      if ($scope.statusComment) {
        console.log($scope.statusComment);
        $scope.statusComment = Phased.team.statuses[$scope.statusComment.key];
      }
    });

    //Print blank lines in for task area
    $scope.taskTable = [1,2,3,4,5];

    if (Phased.SET_UP)
      //$scope.countActiveTasks = countActiveTasks();
      console.log('here');
    else {
      $scope.$on('Phased:setup', function() {
        //$scope.countActiveTasks = countActiveTasks();
      });
    }
    $scope.goTo = function(location){
      $location.path(location);
    }
    $scope.addTask = function(update) {

      ga('send', 'event', 'Update', 'submited');
      mixpanel.track("Updated Status");

      // prepare task object
    	var team = Phased.team.name;
    	if ($scope.taskForm.$error.maxlength) {
    		alert('Your update is too long!');
        return;
    	}

	    var taskPrefix = '';

	    var status = {
	      name: taskPrefix + update.name,
	      // time: new Date().getTime(), // added in PhasedProvider.makeTaskForDB (internal fn)
	      user: Auth.user.uid,
	      cat : $scope.selectedCategory || '',
	      city: $scope.city || 0,
	      weather: '',
	      taskPrefix : taskPrefix,
	      photo : $scope.bgPhoto || 0,
	      location: {
	        lat : $scope.lat || 0,
	        long : $scope.long || 0
	      }
	    };
      if($scope.selectedTask.name){
        status.task = {
          project : '0A',
          column : '0A',
          card : '0A',
          id : $scope.selectedTask.id,
          name : $scope.selectedTask.name
        }
        $scope.selectedTask = {};
      }

      //console.log('status:', status);
      // push to db

      Phased.addStatus(status);



      // reset interface
      $scope.selectedCategory = undefined;
      $scope.task = {};
    } // end $scope.addTask;

    // selects a category, used in addTask
    $scope.categoryChoice = function(key, close){
      ga('send', 'event', 'Update', 'Category selected');
      mixpanel.track("Selected Category");
      $scope.selectedCategory = key;
      if (close) {
        $('#catModal').modal('toggle');
      }
    }

    $scope.moreCat = function(){
      mixpanel.track("Open Category Modal");
      $('#catModal').modal('toggle');
    }

    $scope.addNewCat = function(){
      mixpanel.track("Closed Category Modal");
      $('#catModal').modal('toggle');
      $location.path('/team/addcategory');
    }

    $scope.startTask = function(task) {
      if (!task.user || task.unassigned)
        Phased.takeTask(task.key);
      Phased.activateTask(task.key);

      $scope.activeStream = Phased.assignments.to_me;
      $scope.activeStatusFilter = Phased.task.STATUS_ID.ASSIGNED;
    }

    $scope.setTaskCompleted = function(assignmentID) {
      Phased.setAssignmentStatus(assignmentID, Phased.task.STATUS_ID.COMPLETE);
    }

    $scope.selectedTask = {};
    $scope.moreTasks = function(){
      mixpanel.track("Open Task Modal");
      $('#taskModal').modal('toggle');
    }
    $scope.taskChoice = function(task){
      mixpanel.track("Add Task to status");
      $scope.selectedTask = task;
      $('#taskModal').modal('toggle');
    }
    $scope.cleartaskChoice = function(){
      mixpanel.track("Cleared Task from status");
      $scope.selectedTask = {};
      $('#taskModal').modal('toggle');
    }
    //Delete status flow
    $scope.deleteSelected = function(item){
      $scope.deleteHolder = item;
    }
    $scope.deleteTask = function(item){
      mixpanel.track("Deleted Status");
      console.log(item)
      //move this to the PhasedProvider
      var ref = new Firebase(FURL);
      //check if update has task
      if (item.task) {
        //remove task from task statuses history
        var locate = "team/"+Phased.team.uid+"/projects/"+item.task.project+"/columns/"+item.task.column+"/cards/"+item.task.card+"/tasks/"+item.task.id+"/statuses";

        ref.child(locate)
        .orderByValue()
        .equalTo(item.key)
        .once('value',function(snap){
          var s = snap.val();
          s = Object.keys(s);
          console.log(s);
          console.log(snap.key());
          //var ref = new Firebase(s).set(null);
          ref.child(locate+"/"+s[0]).remove();

          $scope.$digest();
        });
      }
      //rm from FB
      ref.child('team')
      .child(Phased.team.uid)
      .child('statuses')
      .child(item.key)
      .set(null);
      //rm from local
      delete $scope.team.statuses[item.key];
      toaster.pop('success', "Success!", "Your status was deleted!");
    }

    //edit status flow
    $scope.editStatusSelected = function(item){
      $scope.editHolder = angular.copy(item);
      $scope.origItem = item;
    }

    $scope.editStatus = function(){
      mixpanel.track("Edited Status");

      var ref = new Firebase(FURL);
      var editedStatus = $scope.editHolder;
      var origStatus = $scope.origItem;
      //check if tasks exists on
      if(editedStatus.task){
        //are the tasks the same?
        if (origStatus.task != editedStatus.task) {
          //task was changed or added to status

          // was there a task on the status in the first place?
          if(origStatus.task){
            //yes, we should delete the status from the task
            var locate = "team/"+Phased.team.uid+"/projects/"+origStatus.task.project+"/columns/"+origStatus.task.column+"/cards/"+origStatus.task.card+"/tasks/"+origStatus.task.id+"/statuses";

            ref.child(locate)
            .orderByValue()
            .equalTo(origStatus.key)
            .once('value',function(snap){
              var s = snap.val();
              if(s){
                s = Object.keys(s);
                console.log(s);
                console.log(snap.key());
                ref.child(locate+"/"+s[0]).remove();
              }

            });
          }

          if(editedStatus.task.id != ""){
            //Is there a new task?
            editedStatus.task = {
              project : '0A',
              column : '0A',
              card : '0A',
              id : editedStatus.task.id,
              name : Phased.team.projects['0A'].columns['0A'].cards['0A'].tasks[editedStatus.task.id].name
            }
            ref.child('team').child(Phased.team.uid).child('projects/' + editedStatus.task.project +'/columns/'+editedStatus.task.column +'/cards/'+ editedStatus.task.card +'/tasks/'+editedStatus.task.id+'/statuses').push(origStatus.key);
            //no, lets move on and add it to the new task
          }else{
            editedStatus.task = "";
          }
        }
      }

      ref.child('team').child(Phased.team.uid).child('statuses').child(editedStatus.key).update(editedStatus);
      $scope.team.statuses[$scope.editHolder.key] = editedStatus;
      $('#editModal').modal('toggle');
    }


    $scope.likeStatus = function(item,key){
      console.log(item);
      console.log(key);
      mixpanel.track("Liked Status");
      var ref = new Firebase(FURL);
      //check if user has liked status
      if (item.likes) {
        if (item.likes[Phased.user.uid]) {
          //remove like;
          ref.child('team').child(Phased.team.uid).child('statuses').child(key).child('likes').child(Phased.user.uid).set(null);

        }else{
          //push like to status
          ref.child('team').child(Phased.team.uid).child('statuses').child(key).child('likes').child(Phased.user.uid).set(Phased.user.uid);
          likeNotif(item.user, Phased.user.uid);
        }
      }else{
        //push like to status
        ref.child('team').child(Phased.team.uid).child('statuses').child(key).child('likes').child(Phased.user.uid).set(Phased.user.uid);
        likeNotif(item.user, Phased.user.uid);

      }


    }

    function likeNotif(user,likedUser){

      if (user != likedUser) {
        // not self loving post
        var u1 = {}, u2 = {};
        u1.name = Phased.team.members[user].name;
        u1.email = Phased.team.members[user].email;

        u2.name = Phased.team.members[likedUser].name;
        u2.email = Phased.team.members[likedUser].email;

        console.log(u1,u2);
        $http.post('./api/notification/like', {user: u1,likedUser:u2})
          .then(function(res){
            console.log(res);
          });
      }

    }

    $scope.countInts = function(likes){
      if(likes){
        return Object.keys(likes).length;
      }else{
        return "";
      }

    }
    $scope.showLikers = function(likes){
      if(likes){
        var keys = Object.keys(likes);
        var str = "";
        for (var i = 0; i < keys.length; i++) {
           str += Phased.team.members[keys[i]].name + "\n";
        }
        return str;
      }


    }


    //Comments

    $scope.getCommentStatus = function(status,key){
      $scope.statusComment = status;
      $scope.statusComment.key = key;
    }
    $scope.postComment = function(comment){
      mixpanel.track("Posted Comment");
      if (comment) {
        var status = $scope.statusComment;
        var ref = new Firebase(FURL);

        var comment = {
  	      name: comment,
  	      time: new Date().getTime(),
  	      user: Auth.user.uid,

  	    };
        ref.child('team').child(Phased.team.uid).child('statuses').child(status.key).child('comments').push(comment);
        commentNotif(Phased.user.uid,status,comment);
        $scope.comment ="";

      }
    }

    function commentNotif(user,status,comment){
      if (user != status.user) {
        // not self loving post
        var u1 = {}, u2 = {};
        u1.name = Phased.team.members[Phased.user.uid].name;
        u1.email = Phased.team.members[Phased.user.uid].email;

        u2.name = Phased.team.members[status.user].name;
        u2.email = Phased.team.members[status.user].email;

        console.log(u1,u2);
        $http.post('./api/notification/comment', {commentingUser: u1,statusOwner:u2,message:comment.name,status:status.name})
          .then(function(res){
            console.log(res);
          });
      }
    }

    //change feed filter
    $scope.filterFeed = 'recent';
    $scope.changeFilter = function(string){
      if(string == 'recent'){
        $scope.filterFeed = 'recent';
      }else if(string == 'members'){
        $scope.filterFeed = 'members';
      }
    }


    //Add members to team

    $scope.canAddMembers = function(){
      var k = Object.keys(Phased.team.members);
      console.log(k);
      $scope.numMembers = k.length;
      if(k.length <= 10){
        return true;
      }else{
        return false;
      }
    };
    $scope.addMembers = function(newMember) {
      $('#addMemberModal').modal('toggle');
      mixpanel.track("Sent Invite");
      Phased.addMember(newMember);
    };


    //attachments

    $scope.attchmentListener = function(text){
      //console.log(text);
      // var urlPattern = new RegExp();
      // var test = urlPattern.test(text);
      // var res = text.match(urlPattern);
      // console.log(test);
      // console.log(res);
      // var patterns = {
      //   // FUCK THESE 3 w's! >:(
      //   protocol: '^(http(s)?(:\/\/))?(www\.)?',
      //   domain: '[a-zA-Z0-9-_\.]+',
      //   tld: '(\.[a-zA-Z0-9]{2,})',
      //   params: '([-a-zA-Z0-9:%_\+.~#?&//=]*)'
      // } // /([www])?\.?((\w+)\.+)([a-zA-Z]{2,})/gi
      // var p = patterns;
      // var pattern = new RegExp(p.protocol + p.domain + p.tld + p.params, 'gi');
      // var res = pattern.exec(text);
      //console.log(res);
    }




    //Tasks

    $scope.setCompleted = function(task) {
      console.log(task);
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

    $scope.sendToTask = function(project,column,card,key){

      $location.path('/tasks/'+ project +'/'+ column +'/'+ card +'/'+ key);
    }

    $scope.$on('Phased:inviteSuccess', function() {
      toaster.pop('success', "Success!", "Invite sent!");
    });
    $scope.$on('Phased:inviteFailed', function() {
      toaster.pop('error', "Error!", "Invite failed! Please ensure the email is valid");
    });

  });
