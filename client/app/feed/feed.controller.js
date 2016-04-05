'use strict';

angular.module('webappApp')

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
    $scope.taskPriorities = Phased.TASK_PRIORITIES; // in new task modal
    $scope.taskStatuses = Phased.TASK_STATUSES; // in new task modal
    $scope.taskPriorityID = Phased.TASK_PRIORITY_ID;
    $scope.taskStatusID = Phased.TASK_STATUS_ID;
    $scope.meta = {
    	status : Phased.status
    }
    $scope.user = Phased.user;
    $scope.deleteHolder = '';
    $scope.editHolder = '';
    $scope.atTop = true;


		angular.element($window).bind('scroll', _.debounce(function scrollHandler() {
    	$scope.atTop = $window.pageYOffset < 100;
    	$scope.$digest();
    }, 200));

    //bootstrap opt-in func;

    setTimeout(function(){ Phased.doAsync() }, 2000);
    //angular.element($('[data-toggle="tooltip"]')).tooltip();


    // get number of active tasks assigned to userID
    var countActiveTasks = function countActiveTasks() {
      var count = 0;
      var thing = [];
      _.forEach(Phased.team.projects['0A'].columns['0A'].cards['0A'].tasks, function(value, key){
        if((value.status == 0 || value.status == 2) && value.assigned_to == Phased.user.uid){
          count++;
          value.id = key;
          thing.push(value);
        }
      });
      $scope.getUserTasks = thing;

      return count
    }
    $scope.$on('Phased:changedStatus', function(){
      if ($scope.statusComment) {
        console.log($scope.statusComment);
        $scope.statusComment = Phased.team.statuses[$scope.statusComment.key];
      }
    });

    //Print blank lines in for task area
    $scope.taskTable = [1,2,3,4,5];

    if (Phased.SET_UP)
      $scope.countActiveTasks = countActiveTasks();
    else {
      $scope.$on('Phased:setup', function() {
        $scope.countActiveTasks = countActiveTasks();
      });
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
      $scope.activeStatusFilter = Phased.TASK_STATUS_ID.ASSIGNED;
    }

    $scope.setTaskCompleted = function(assignmentID) {
      Phased.setAssignmentStatus(assignmentID, Phased.TASK_STATUS_ID.COMPLETE);
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


    $scope.likeStatus = function(item){
      mixpanel.track("Liked Status");
      var ref = new Firebase(FURL);
      //check if user has liked status
      if (item.likes) {
        if (item.likes[Phased.user.uid]) {
          //remove like;
          ref.child('team').child(Phased.team.uid).child('statuses').child(item.key).child('likes').child(Phased.user.uid).set(null);

        }else{
          //push like to status
          ref.child('team').child(Phased.team.uid).child('statuses').child(item.key).child('likes').child(Phased.user.uid).set(Phased.user.uid);

        }
      }else{
        //push like to status
        ref.child('team').child(Phased.team.uid).child('statuses').child(item.key).child('likes').child(Phased.user.uid).set(Phased.user.uid);

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

    $scope.getCommentStatus = function(status){
      $scope.statusComment = status;
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
        $scope.comment ="";

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
    $scope.$on('Phased:inviteSuccess', function() {
      toaster.pop('success', "Success!", "Invite sent!");
    });
    $scope.$on('Phased:inviteFailed', function() {
      toaster.pop('error', "Error!", "Invite failed! Please ensure the email is valid");
    });

  });
