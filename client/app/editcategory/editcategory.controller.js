'use strict';

angular.module('webappApp')
  .controller('EditcategoryCtrl', function ($scope, $http, stripe, Auth, FURL,amMoment,$location) {
    var ref = new Firebase(FURL);
    $scope.team = {
      name : '',
      members : {},
      history : [],
      categorySelect : [],
      categoryObj : {}
    };
    $scope.init = function(){
    	//I need the current team.

    	ref.child('profile').child(Auth.user.uid).child('curTeam').once('value',function(data){
        	data = data.val();
        	$scope.team.name = data;
        	$scope.getCategories();
        });
    };

    $scope.getCategories = function(){
    	var team = $scope.team.name;
    	new Firebase(FURL).child('team').child(team).child('category').once('value', function(cat) {
    		cat = cat.val();
    		console.log(cat);
    		if(typeof cat !== 'undefined' && cat != null){
    			
    			var keys = Object.keys(cat);
    			$scope.team.categoryObj = cat;
	        	for(var i = 0; i < keys.length; i++){
	        		var obj = {
	        			name : cat[keys[i]].name,
	        			color : cat[keys[i]].color,
	        			key : keys[i]
	        		}
	          		$scope.team.categorySelect.push(obj);
	       		}
	       		console.log($scope.team);
    		}else{
    			//they have no categories so add them
    			var obj = [
    				{
    					name : 'Communication',
    					color : '#ffcc00'
    				},
    				{
    					name : 'Planning',
    					color : '#5ac8fb'
    				}
    			];
    			new Firebase(FURL).child('team').child(team).child('category').set(obj);
    			new Firebase(FURL).child('team').child(team).child('category').once('value', function(cat) {
    				cat = cat.val();
	    			var keys = Object.keys(cat);
	    			$scope.team.categoryObj = cat;
		        	for(var i = 0; i < keys.length; i++){
		        		var obj = {
		        			name : cat[keys[i]].name,
		        			color : cat[keys[i]].color,
		        			key : keys[i]
		        		}
		          		$scope.team.categorySelect.push(obj);
		       		}
		       		console.log($scope.team);
    			});
    		}
    	});
    };

    $scope.init();

  });
