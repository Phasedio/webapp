'use strict';

angular.module('webappApp')
  .controller('LoginCtrl', function ($scope, Auth,$location) {
    $scope.message = 'Hello';
    console.log('yo');
    $scope.login = function(user){
    	console.log(user);
    	Auth.login(user).then(function(){
    		$location.path('/');
    	},function(err){
    		alert(err);
    	});

    }

  });
