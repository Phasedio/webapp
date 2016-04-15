'use strict';

angular.module('webappApp')
  .controller('MainCtrl', function ($scope, Auth, Phased, toaster, $location) {
    ga('send', 'pageview', '/team');
    $scope.team = Phased.team;
    $scope.taskList = Phased.get.tasks;
    $scope.Phased = Phased;
    $scope.logout = function(){
      console.log('logging you out');
      Auth.logout();
      $location.path('/login');
    }
    $scope.getTasks = {}
    setTimeout(function(){ Phased.doAsync() }, 3000);
    function getUserTasks(){
      var members = {};
      _.forEach(Phased.team.members, function(value, key) {
        console.log(key);
        var userTasks = [];
        var user = key;
        _.forEach(Phased.get.tasks, function(value, key) {
          if (value.assigned_to == user && userTasks.length < 5 && value.status != Phased.task.STATUS_ID.COMPLETE) {
            userTasks.push(key);

          }
        });
        members[user] = userTasks;
      });
      $scope.getTasks = members;
      console.log(members);
      //$scope.$digest();
    }
    if (Phased.SET_UP) {
      getUserTasks();
    }

    $scope.$on('Phased:setup', function() {
      if (!Phased.team.uid) {
        $location.path('/onboarding');
      }
      getUserTasks();

      // $scope.$digest(); // instead of apply; only affects current scope instead of rootscope
    });

    $scope.$on('Phased:meta', function(){
      if (!Phased.team.uid) {
        $location.path('/onboarding');
      }
    });



});
