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
    $scope.returnValues = {};
    $scope.catSelect = "";


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
      console.log($scope.catSelect);
      for (var i = 0; i < users.length; i++) {
        getData(users[i],$scope.catSelect);
      }
    };

    function getData(user,cat){
      var x = user;
      if(cat){
        FBRef.child('team').child(Auth.currentTeam).child('all').child(x).orderByChild("cat").equalTo(cat).once('value',function(snap){
          $scope.returnValues[x] = snap.val();

        });
      }else{
        FBRef.child('team').child(Auth.currentTeam).child('all').child(x).once('value',function(snap){
          $scope.returnValues[x] = snap.val();

        });
      }

    }






  });
