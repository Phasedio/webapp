'use strict';

angular.module('webappApp')
  .controller('MainCtrl', function ($scope, $http, stripe, Auth, FURL) {
    $scope.team = {
      name : '',
      members : []
    };


    /**
    * 
    */
    $scope.checkStatus = function(){
     var team = $scope.team.name;
     new Firebase(FURL).child('team').child(team).child('task').on('value', function(users) {
     $scope.team.members = [];
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
               //console.log(memberID);
        var p = data.val();
               //console.log(p);
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
               
        $scope.team.members.push(teamMember);
        $scope.$apply();

        });
    }

    $scope.getHistory = function(uid){
      var ref = new Firebase(FURL);
      ref.child('team').child($scope.team.name).child('all').child(uid).once('value',function(data){
        data = data.val();
        $http.post('../api/downloads', {hose:data}).success(function(data){
          console.log(data);
          window.open('../api/downloads/'+data);
        });
      });
    }

    $scope.init = function(){
      var ref = new Firebase(FURL);
      console.log(Auth.user);
      ref.child('profile').child(Auth.user.uid).child('curTeam').once('value',function(data){
        data = data.val();
        $scope.team.name = data;
        $scope.checkStatus();

      })
    }


  $scope.init();

  });
