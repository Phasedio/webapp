'use strict';

angular.module('webappApp')
  .controller('FeedCtrl', function ($scope, $http, stripe, Auth, FURL,amMoment) {
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
        	$scope.getCategories();
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
    }

    $scope.addTask = function(update){
    	var team = $scope.team.name;
    	if($scope.taskForm.$error.maxlength){
    		alert('Your update is too long!');
    	}else{
    		console.log(update);
		    var taskPrefix = '';
		    
		    var weather,city,lat,long,photo;
		    //weather = $scope.weatherIcon != '' ? $scope.weatherIcon : 0;
		    city = $scope.city ? $scope.city : 0;
		    lat = $scope.lat ? $scope.lat : 0;
		    long = $scope.long ? $scope.long : 0;
		    photo = $scope.bgPhoto ? $scope.bgPhoto : 0;
		    var status = {
		      name: taskPrefix+update.name,
		      time: new Date().getTime(),
		      user:Auth.user.uid,
		      cat : update.cat,
		      city:city,
		      weather:'',
		      taskPrefix : taskPrefix,
		      photo : photo,
		      location:{
		        lat : lat,
		        long : long
		      }


		    };
		    var teamRef = new Firebase(FURL);
		    console.log(status);
        console.log(status.time);
		    teamRef.child('team').child(team).child('task').child(Auth.user.uid).set(status);
		    teamRef.child('team').child(team).child('all').child(Auth.user.uid).push(status,function(){
		      console.log('status set');
		      $scope.updateStatus = '';
          //we are getting the user.uid, we need to extract the member off the user.uid.
          //then we can do a scope.setSelected off that member.

            //Send push notifications to team
		      // $http.get('http://45.55.200.34:8080/push/update/'+team+'/'+Auth.user.name+'/'+status.name,'').success(function(data){
		      //   //alert(data);
		      // });

		    });

		$scope.task = update;
        $scope.taskName = '';
		$scope.showTaskView = true;
        $scope.taskTime = status.time; // we didnt have status.time so i think this fixes the problem(?)
      // maybe we need a timeout function here to run around out $apply()??

        //$scope.$apply();

        //need to find out what the member/who is
        //$scope.getTaskHistory(member);

	    }

    }


    $scope.init();

    window.setInterval(function () {
    $scope.$apply();
  }, 500);

    
  }); 
