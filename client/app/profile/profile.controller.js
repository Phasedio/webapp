'use strict';

angular.module('webappApp')
  .filter('tel', function() {
    return function(tel) {
      var res = formatLocal('CA', tel);
      return res || tel;
    }
  })
  .controller('ProfileCtrl', function ($scope,$routeParams, $http, stripe, Auth, Phased, FURL,amMoment,$location) {
    ga('send', 'pageview', '/profile');

    $scope.phased = Phased;
    $scope.team = Phased.team;
    $scope.viewType = Phased.viewType;
    $scope.taskStatuses = Phased.TASK_STATUSES;
    $scope.taskPriorities = Phased.TASK_PRIORITIES;

    // Check to see if there are route perams for this page if so load up that user
    var profileUser;
    if ($routeParams.userid) profileUser = $routeParams.userid;
    else profileUser = Auth.user.uid;

    $scope.currentUser = Phased.team.members[profileUser];

    $scope.$on('Phased:setup', function(){
      $scope.currentUser = Phased.team.members[profileUser];
      $scope.$apply();
      initStats();
    });
    $scope.$on('Phased:history', function(){
      $scope.$apply();
    });

    $scope.stats = {
      totalUpdates: 0,
      totalTasks:0,
      weekUpdates:0,
      weekTasks:0,
      todaysUpdates : 0,
      todaysTasks : 0

    }
    var FBRef = new Firebase(FURL);

  // bootstrap enable tabs

  $('#myTabs a').click(function (e) {
    e.preventDefault()
    $(this).tab('show')
  });
  // prevent Update
  $scope.person = false;
  if(profileUser == Auth.user.uid) $scope.person = true;
  else $scope.person = false;


  //logout

  $scope.logout = function(){
      console.log('logging you out');
      Auth.logout();
      $location.path('/login');
    }


    function getTodaysUpdates(){
      //return var init
      $scope.stats.todaysTasks = 0;

      //get todays date at midnight... in Unix
      var today = [new Date().getDate(),new Date().getMonth(),new Date().getFullYear()];
      var midnight = new Date(today[2],today[1],today[0]).getTime();
      FBRef.child('team').child(Auth.currentTeam).child('all').child(profileUser).orderByChild("time").startAt(midnight).once('value',function(snap){
        $scope.stats.todaysUpdates = $scope.stats.todaysUpdates + snap.numChildren();
      });

      // return the total number of updates today
    }

    //Check number of completed tasks today.
    function getTodaysCompleteTasks(){
      $scope.stats.todaysTasks = 0;
      //get todays date at midnight... in Unix
      var today = [new Date().getDate(),new Date().getMonth(),new Date().getFullYear()];
      var midnight = new Date(today[2],today[1],today[0]).getTime();
      FBRef.child('team').child(Auth.currentTeam).child('assignments').child('all').orderByChild("completeTime").startAt(midnight).once('value',function(snap){
        $scope.stats.todaysTasks = $scope.stats.todaysTasks + snap.numChildren();

      });

    }

    function getWeekUpdates(){
      //return var init
      $scope.stats.WeekTasks = 0;

      //get todays date at midnight... in Unix
      var today = [new Date().getDate(),new Date().getMonth(),new Date().getFullYear()];
      var midnight = new Date(today[2],today[1],today[0]).getTime();
      var weekOffSet = midnight - ((new Date(midnight).getDay()) * 86400000);
      FBRef.child('team').child(Auth.currentTeam).child('all').child(profileUser).orderByChild("time").startAt(weekOffSet).endAt(midnight).once('value',function(snap){
        $scope.stats.weekUpdates = snap.numChildren();
      });

      // return the total number of updates today
    }
    function getWeekTasks(){
      //return var init
      $scope.stats.weekTasks = 0;

      //get todays date at midnight... in Unix
      var today = [new Date().getDate(),new Date().getMonth(),new Date().getFullYear()];
      var midnight = new Date(today[2],today[1],today[0]).getTime();
      var weekOffSet = midnight - ((new Date(midnight).getDay()) * 86400000);
      console.log(midnight);
      console.log(weekOffSet);
      FBRef.child('team').child(Auth.currentTeam).child('assignments').child('all').orderByChild("completeTime").startAt(weekOffSet).once('value',function(snap){
        $scope.stats.weekTasks = snap.numChildren();
      });

      // return the total number of updates today
    }

    function getAllUpdates(){
      //return var init
      $scope.stats.totalUpdates = 0;

      FBRef.child('team').child(Auth.currentTeam).child('all').child(profileUser).once('value',function(snap){
        $scope.stats.totalUpdates =  snap.numChildren();
      });


      // return the total number of updates today
    }

    function getAllCompleteTasks(){
      $scope.stats.totalTasks = 0;


      FBRef.child('team').child(Auth.currentTeam).child('assignments').child('all').orderByChild("completeTime").startAt(100).once('value',function(snap){
        $scope.stats.totalTasks =  snap.numChildren();

      });

    }
    function initStats(){
      getTodaysUpdates();
      getTodaysCompleteTasks();
      getWeekUpdates();
      getWeekTasks();
      //getAllUpdates();
      getAllCompleteTasks();
    }








  // Update Account
  $scope.updateUser = function(update){
    var toaster = { pop : function(a) { console.log(a) } }; // patch while the toaster disappeared!
    if (update.email === undefined || update.email === '') {
      update.email = $scope.currentUser.email;
    }
    if (update.tel !== $scope.currentUser.tel) {
      console.log('hit the tel!');
      if (Auth.changeTel(update, Auth.user.uid)) {
        toaster.pop('success', "Your phone number has been updated");
        $scope.currentUser.tel = update.tel;
      } else {
        toaster.pop('error', 'Invalid phone number');
      }
    }

    if (update.name === $scope.currentUser.name || update.name === undefined || update.name === ''){
      //console.log("we are changing the password");
      if(update.oldPass && update.newPass){
        console.log('we will change the password');
        Auth.changePassword(update).then(function (){
          console.log('will change password');
          toaster.pop('success', "Your password has been changed!");
        }, function(err) {
          console.log('error', err);
          if (err == "Error: The specified password is incorrect.") {
            console.log("we are here");
            toaster.pop('error', 'Your current password is incorrect');
          } else {
            toaster.pop('error', 'Your email is incorrect! Make sure you are using your current email');
          }
        });
      } else {
        console.log('changing email');
        console.log(update.email);
        if (update.email !== $scope.currentUser.email) {
          console.log('we are changing the email', Auth.user.uid);
          Auth.changeEmail(update, Auth.user.uid);
          toaster.pop('success', "Your email has been updated!");
          $scope.currentUser.email = update.email;
        }
      }
    } else {
      console.log('changing userName or email');
      console.log(update.email);
      if (update.name !== $scope.currentUser.name) {
        Auth.changeName(update, Auth.user.uid);

        new Firebase(FURL).child('profile').child(Auth.user.uid).once('value', function(user) {
          user = user.val();

          console.log(user);
          console.log(Auth.user.uid);
        });

        toaster.pop('success', "Your name has been updated!");
      }

      if (update.email !== $scope.currentUser.email) {
        Auth.changeEmail(update, Auth.user.uid);
        toaster.pop('success', "Your email has been updated!");
      }
    }
  };
});
