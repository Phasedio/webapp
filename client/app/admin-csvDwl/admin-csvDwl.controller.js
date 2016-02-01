'use strict';

angular.module('webappApp')
  .controller('AdminCsvDwlCtrl', function ($scope, $http, stripe, Auth, Phased, FURL,amMoment, $location) {
    ga('send', 'pageview', '/admin');

    $scope.viewType = Phased.viewType;
    $scope.myID = Auth.user.uid;
    $scope.team = Phased.team;
    $scope.Phased = Phased;


    //form vars

    var users = [],category = [],time = [];

    // bounce users without Admin or Owner permissions
    $scope.$on('Phased:currentUserProfile', function(){
      if (Auth.user.role == 'member')
        $location.path('/feed');
    });

    $scope.toggleMember = function(uid){
      var id = uid;
      //check if uid is in arr
      var x = _.findIndex(users, function(o) { return o == uid;});
      console.log(x);
      if(x != -1){
        //if so remove it from arr
        _.remove(users,function(o) { return o == uid;});
        //remove active class to element
        $("#"+uid).toggleClass("active");
        //document.querySelectorAll("[data-member='"+uid+"']").className = "";

      }else{
        //if not add it
        users.push(uid);
        //add active class to element
        $("#"+uid).toggleClass("active");
        //document.querySelectorAll("[data-member='"+uid+"']").className = "active";

      }
      console.log(users);


      //if not add it
      //add active class to element

    }





  });
