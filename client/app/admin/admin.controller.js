'use strict';

angular.module('webappApp')
  .controller('AdminCtrl', function ($scope, $http, stripe, Auth, Phased, FURL,amMoment, $location) {
    ga('send', 'pageview', '/admin');

    $scope.viewType = Phased.viewType;
    $scope.myID = Auth.user.uid;
    $scope.team = Phased.team;
    $scope.Phased = Phased;

    // bounce users without Admin or Owner permissions
    $scope.$on('Phased:currentUserProfile', function(){
      if (Auth.user.role != 'admin' || Auth.user.role != 'owner')
        $location.path('/feed');
    });

  $scope.changeRole = function(member) {
    Phased.changeMemberRole(member.uid, member.role);
  }

  });
