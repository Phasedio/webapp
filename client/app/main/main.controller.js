'use strict';

angular.module('webappApp')
  .controller('MainCtrl', function ($scope, $http, stripe, Auth, Phased, FURL,amMoment,toaster, $location) {
    ga('send', 'pageview', '/team');
    $scope.showMember = false;
    $scope.team = Phased.team;
    $scope.viewType = Phased.viewType;

    var monImage =  "weekdayPhotos/mon.jpg";
    var tuesImage =  "weekdayPhotos/tues.jpg";
    var wedImage =  "weekdayPhotos/wed.jpg";
    var thursImage =  "weekdayPhotos/thurs.jpg";
    var friImage = "weekdayPhotos/fri.jpg";
    var satImage = "weekdayPhotos/sat.jpg";
    var sunImage = "weekdayPhotos/sun.jpg";

    var d=new Date();
    var backgroundImage = [sunImage, monImage, tuesImage, wedImage, thursImage, friImage, satImage];
    $scope.dayImage = backgroundImage[d.getDay()];


    /**
    *
    * goToMemeber(uid)
    * sends user to profile of user
    */
    $scope.goToUser = function(uid){
      $location.path('/profile/'+uid);
    }

    $scope.addMembers = function(newMember) {
      PhasedProvider.addMember(newMember, $scope.team.members[Auth.user.uid]);
      //close modal
      $('#myModal').modal('toggle');
    };

    $scope.addMemberModel = function(){
      ga('send', 'event', 'Modal', 'Member add');
      $('#myModal').modal('toggle');
    }


});
