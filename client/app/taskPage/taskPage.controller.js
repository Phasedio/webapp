'use strict';

angular.module('webappApp')
  .controller('TaskPageCtrl', function ($scope, $http, stripe, Auth, Phased, FURL,amMoment,toaster,uiCalendarConfig,$routeParams,$location) {
    $scope.message = 'Hello';


    $scope.phased = Phased;
    $scope.team = Phased.team;
    $scope.assignments = Phased.assignments;
    $scope.archive = Phased.archive;
    $scope.taskInfo = {}; // Task information for the description area


    function init(){
      // get route peram and try to assign it
      console.log($scope.assignments);
      if($routeParams.taskID && Phased.assignments.all[$routeParams.taskID]){
        $scope.taskInfo = Phased.assignments.all[$routeParams.taskID];
        console.log($scope.taskInfo);

      }else{
        //fail - send user to tasks page
        //$location.path("/tasks")
      }
    }
    init();


  });
