'use strict';

angular.module('webappApp')
  .controller('AddcategoryCtrl', function ($scope, $http, stripe, Auth, FURL,amMoment,$location) {
    var ref = new Firebase(FURL);
    $scope.team = {
      name : '',
      members : {},
      history : [],
      categorySelect : [],
      categoryObj : {}
    };


    //on load we need to get a list of all the updates that have happened today.
    $scope.init = function(){
    	//I need the current team.

    	ref.child('profile').child(Auth.user.uid).child('curTeam').once('value',function(data){
        	data = data.val();
        	$scope.team.name = data;
        });
    };
    $scope.addCat = function(cat){
    	console.log(cat);
    	cat.created = new Date().getTime();
    	cat.user = Auth.user.uid;
    	new Firebase(FURL).child('team').child($scope.team.name).child('category').push(cat);
    	$location.path('/feed');
    };

    $scope.init();
  });
