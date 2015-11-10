'use strict';

angular.module('webappApp')
  .controller('FeedCtrl', function ($scope, $http, stripe, Auth, FURL,amMoment) {
    var ref = new Firebase(FURL);
    $scope.team = {
      name : '',
      members : {},
      history : []
    };


    //on load we need to get a list of all the updates that have happened today.
    $scope.init = function(){
    	//I need the current team.
    	ref.child('profile').child(Auth.user.uid).child('curTeam').once('value',function(data){
        	data = data.val();
        	$scope.team.name = data;
        	$scope.checkStatus();
        });
    };

    $scope.checkStatus = function(){
     var team = $scope.team.name;
     new Firebase(FURL).child('team').child(team).child('task').on('value', function(users) {
     $scope.team.history = [];
       users = users.val();
       
       if(users){
         var teamUID = Object.keys(users);

            for (var i = 0; i < teamUID.length; i++) {
                $scope.getTeamTasks(teamUID[i], users);
            }

            //console.log($scope.teamMembers);
            //$scope.$apply();
       }

     });
   };
   $scope.getTeamTasks = function(memberID,users){
      var userrefs = new Firebase(FURL + 'profile/' + memberID);
      userrefs.once("value", function(data) {
        var p = data.val();
        var pic,style;
        if(users[memberID].photo){
          style = "background:url("+users[memberID].photo+") no-repeat center center fixed; -webkit-background-size: cover;-moz-background-size: cover; -o-background-size: cover; background-size: cover";
        }else{
          style = false;
        }
        var teamMember = {
          name : p.name,
          pic : p.gravatar,
          task : users[memberID].name,
          time : users[memberID].time,
          weather:users[memberID].weather,
          city:users[memberID].city,
          uid : memberID,
          photo:style
        };
               
        $scope.team.members[memberID] = teamMember;
        var startTime = new Date().getTime();
	    var endTime = startTime - 86400000;
	    console.log(startTime);


	    ref.child('team').child($scope.team.name).child('all').child(memberID).orderByChild('time').startAt(endTime).once('value',function(data){
	    	if(data){
	    		data = data.val();
	        	console.log(data);
	        	var keys = Object.keys(data);
	        	for(var i = 0; i < keys.length; i++){
	          		$scope.team.history.push(data[keys[i]]);
	       		}
	        
	      	//$scope.$apply();
	    	}
	    	
	     });

        });
    };


    $scope.init();

    window.setInterval(function () {
    $scope.$apply();
  }, 500);

    window.setInterval(function () {
    
    console.log($scope.team)
  }, 5000);
  }); 
