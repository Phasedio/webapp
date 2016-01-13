'use strict';

angular.module('webappApp')
  .controller('AdminCtrl', function ($scope, $http, stripe, Auth, Phased, FURL,amMoment, $location) {
    ga('send', 'pageview', '/admin');

    $scope.viewType = Phased.viewType;
    $scope.myID = Auth.user.uid;
    $scope.team = Phased.team;

    // bounce users without Admin or Owner permissions
    $scope.$on('Phased:currentUserProfile', function(){
      if (Auth.user.role != 'Admin' || Auth.user.role != 'Owner')
        $location.path('/feed');
    });



  });
