'use strict';

angular.module('webappApp')
  .controller('AdminCsvDwlCtrl', function ($scope, $http, stripe, Auth, Phased, FURL,amMoment, $location) {
    ga('send', 'pageview', '/admin');

    var FBRef = new Firebase(FURL);
    $scope.viewType = Phased.viewType;
    $scope.myID = Auth.user.uid;
    $scope.team = Phased.team;
    $scope.Phased = Phased;


    //form vars

    var users = [],category = [],time = [];
    $scope.returnValues = false;
    $scope.catSelect = "";
    $scope.time = {
      start : '',
      end :''
    };
    var now = new Date().getTime();
    $scope.time.start = new Date(now - 604800000);
    $scope.time.end = new Date(now);

    // bounce users without Admin or Owner permissions
    $scope.$on('Phased:currentUserProfile', function(){
      if (Auth.user.role == 'member')
        $location.path('/feed');
    });

    $scope.toggleMember = function(uid){
      var id = String(uid);
      //check if uid is in arr
      var x = _.findIndex(users, function(o) { return o == uid;});
      console.log(x);
      if(x != -1){
        //if so remove it from arr
        _.remove(users,function(o) { return o == uid;});
        //remove active class to element
        $("#"+id).toggleClass("active");

      }else{
        //if not add it
        users.push(uid);
        //add active class to element
        $("#"+id).toggleClass("active");

      }
      console.log(users);
    }

    $scope.getTasks = function(){
      console.log($scope.time);
      $scope.returnValues = {};
      console.log($scope.catSelect);
      for (var i = 0; i < users.length; i++) {
        getData(users[i],$scope.catSelect);
      }
    };

    $scope.exportData = function(){
      console.log($scope.returnValues);
    }

    function getData(user,cat){
      var x = user;
      var s = new Date($scope.time.start).getTime();//start time
      var e = new Date($scope.time.end).getTime();//end time
      if(cat){
        FBRef.child('team').child(Auth.currentTeam).child('all').child(x).orderByChild("cat").equalTo(cat).once('value',function(snap){
          var y = snap.val();
          var a = []
          console.log(y);
          _.forOwn(y, function(value, key) {
            if(value.time > s && value.time < e){
              a.push(value);
            }
          } );

          console.log(y,a);
          $scope.returnValues[x] = a;

        });
      }else{
        FBRef.child('team').child(Auth.currentTeam).child('all').child(x).once('value',function(snap){
          $scope.returnValues[x] = snap.val();

        });
      }

    }






  });
