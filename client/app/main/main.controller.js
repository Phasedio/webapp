'use strict';

angular.module('webappApp')
  .controller('MainCtrl', function ($scope, $http, stripe, Auth, Phased, FURL,amMoment,toaster, $location) {
    ga('send', 'pageview', '/team');
    $scope.showMember = false;
    $scope.team = Phased.team;
    $scope.viewType = Phased.viewType;
    $scope.Phased = Phased;
    var FBRef = new Firebase(FURL);

    //stats vars
    $scope.numUpdates = 0;
    $scope.stats = {
      todaysUpdates : 0,
      todaysTasks : 0

    }

    var itRan = 0;
    // ensure view updates when new members are added
    $scope.$on('Phased:member', function() {
      $scope.$apply();
      itRan = 1;
      getTodaysUpdates();
      getTodaysCompleteTasks();
      getTasksCompletedOverTime();
      getTodaysCatBreakdown();
    });

    setTimeout(function(){
      if(!itRan){
        getTodaysUpdates();
        getTodaysCompleteTasks();
        getTasksCompletedOverTime();
        getTodaysCatBreakdown();
      }

    }, 3000);



    /**
    *
    * goToMemeber(uid)
    * sends user to profile of user
    */
    $scope.goToUser = function(uid){
      $location.path('/profile/' + uid);
    }

    $scope.addMembers = function(newMember) {
      $('#myModal').modal('toggle');
      Phased.addMember(newMember, $scope.team.members[Auth.user.uid]);

    };

    $scope.addMemberModal = function() {
      ga('send', 'event', 'Modal', 'Member add');
      $('#myModal').modal('toggle');
    }

    function getTodaysUpdates(){
      //return var init
      $scope.stats.todaysTasks = 0;

      //get todays date at midnight... in Unix
      var today = [new Date().getDate(),new Date().getMonth(),new Date().getFullYear()];
      var midnight = new Date(today[2],today[1],today[0]).getTime();

      _.forEach($scope.team.members, function(n, key) {
        FBRef.child('team').child(Auth.currentTeam).child('all').child(n.uid).orderByChild("time").startAt(midnight).once('value',function(snap){
          $scope.stats.todaysUpdates = $scope.stats.todaysUpdates + snap.numChildren();
        });
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

    //Create datapoints for velocity chart
    function getTasksCompletedOverTime(){
      $scope.labels = [];
      //$scope.data = [];
      // get todays date at midnight
      var today = [new Date().getDate(),new Date().getMonth(),new Date().getFullYear()];
      var midnight = new Date(today[2],today[1],today[0]).getTime();
      //For 30 days ask fb how many tasks we're completed
      for (var i = 0; i < 30; i++) {
        var thisDay = midnight - (i * 86400000); // get the next day
        var endDay = thisDay + 86400000; // get the end point for search

        var l = new Date(thisDay).getDate();
        $scope.labels.push(l);
        FBRef.child('team').child(Auth.currentTeam).child('assignments').child('all').orderByChild("completeTime").startAt(thisDay).endAt(endDay).once('value',function(snap){
          if(snap){
            var k = snap.numChildren();
            $scope.data[0].push(k);
          }else{
            $scope.data[0].push(0);
          }


        });

      }
      $scope.labels.reverse();
      $scope.data[0].reverse();

    }

    //show category usage in a pie chart
    function getTodaysCatBreakdown(){

      //init break down categories in to labels
      var cLabels = [];
      var cConnector = []; // needed for this array lookup idea
      var cValues = [];
      _.forEach($scope.team.categoryObj, function(n, key) {
        cLabels.push(n.name);
        cConnector.push(key);
        cValues.push(0);

      });


      //get todays date at midnight... in Unix
      var today = [new Date().getDate(),new Date().getMonth(),new Date().getFullYear()];
      var midnight = new Date(today[2],today[1],today[0]).getTime();
      // for every member find all the updates they have made today
      _.forEach($scope.team.members, function(n, key) {
        FBRef.child('team').child(Auth.currentTeam).child('all').child(n.uid).orderByChild("time").startAt(midnight).once('value',function(snap){
          //if there is data open up snap and
          var c = snap.numChildren()
          if(c){
            snap = snap.val();
            var keys = Object.keys(snap);
            //if there is more then one snap
            for (var i = 0; i < keys.length; i++) {
              if (snap[keys[i]].cat) {
                //find index of the label in cConnector
                var a = cConnector.indexOf(snap[keys[i]].cat);
                //place a value at that index in cValues
                cValues[a]++;

              }

            }
          }

        });
      });
      $scope.labelsPie = cLabels;
      $scope.dataPie = cValues;
    }



    // Chart information -- Clean this up
    $scope.labels = ["January", "February", "March", "April", "May", "June", "July"];
  $scope.series = ['Tasks Completed', 'Series B'];
  $scope.data = [[],[0]];
  $scope.onClick = function (points, evt) {
    console.log(points, evt);
  };

  $scope.labelsPie = ["Download Sales"];
$scope.dataPie = [0];


});
