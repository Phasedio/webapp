'use strict';

angular.module('webappApp')
  .controller('MainCtrl', function ($scope, $http, stripe, Auth, Phased, FURL,amMoment,toaster, $location) {
    ga('send', 'pageview', '/team');
    $scope.showMember = false;
    $scope.team = Phased.team;
    $scope.viewType = Phased.viewType;
    var FBRef = new Firebase(FURL);

    //stats vars
    $scope.numUpdates = 0;


    // ensure view updates when new members are added
    $scope.$on('Phased:member', function() {
      $scope.$apply();
      getTodaysUpdates();
    });



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
      //return var init, needs to be attached to scope so it will update when all requests come back
      $scope.numUpdates = 0;

      //get todays date at midnight... in Unix
      var today = [new Date().getDate(),new Date().getMonth(),new Date().getFullYear()];
      var midnight = new Date(today[2],today[1],today[0]).getTime();
      console.log($scope.team);

      // ask firebase for all status from each member that have happened today
      // for (var i = 0; i < $scope.team.members.length; i++) {
      //   // save the length of each user's statuses to var
      // console.log('yo');
      //   FBRef.child('team').child(Auth.currentTeam).child('all').child($scope.team.members[i].uid).orderByChild("time").startAt(midnight).once('value',function(snap){
      //     $scope.numUpdates = $scope.numUpdates + snap.numChildren();
      //   });
      // }
      _.forEach($scope.team.members, function(n, key) {
        FBRef.child('team').child(Auth.currentTeam).child('all').child(n.uid).orderByChild("time").startAt(midnight).once('value',function(snap){
          $scope.numUpdates = $scope.numUpdates + snap.numChildren();
        });
      });

      // return the total number of updates today
    }
    getTodaysUpdates();


    // Chart information -- Clean this up
    $scope.labels = ["January", "February", "March", "April", "May", "June", "July"];
  $scope.series = ['Series A', 'Series B'];
  $scope.data = [
    [65, 59, 80, 81, 56, 55, 40],
    [28, 48, 40, 19, 86, 27, 90]
  ];
  $scope.onClick = function (points, evt) {
    console.log(points, evt);
  };

  $scope.labelsPie = ["Download Sales", "In-Store Sales", "Mail-Order Sales"];
$scope.dataPie = [300, 500, 100];


});
