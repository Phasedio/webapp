'use strict';

angular.module('webappApp')
  .controller('MainCtrl', function ($scope, $http, stripe, Auth, FURL,amMoment) {
    $scope.showMember = false;
    $scope.team = {
      name : '',
      members : []
    };
    $scope.viewType = 'notPaid';

    $scope.selectedUser = {
        name : '',
        gravatar : '',
        uid : '',
        history: []
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

   $scope.checkPlanStatus = function(teamName){
    var ref = new Firebase(FURL);
    console.log('sup');
    ref.child('team').child(teamName).once('value',function(data){
      data = data.val();
      var team = data; 
      console.log(team);
      if(team.billing){
        $scope.billinInfo = team.billing;
        console.log('wohohohohoo');
        $http.post('./api/pays/find',{customer:team.billing.stripeid}).success(function(data){
          console.log(data);
          if(data.err){
            console.log(data.err);
          }
          if(data.status == "active"){
            //Show thing for active
            $scope.viewType = 'active';

          }else if(data.status == 'past_due' || data.status == 'unpaid'){
            //Show thing for problem with account
            $scope.viewType = 'problem';
          }else if(data.status == 'canceled'){
            //Show thing for problem with canceled
            $scope.viewType = 'notPaid';
          }
          console.log($scope.viewType);
          $scope.$apply();
        }).error(function(data){
          console.log(data);
        });
      }else{
        $scope.viewType = 'notPaid';
        $scope.$apply();
      }
    });
    
    
  }

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

    $scope.viewUser = function(user){
      $scope.showMember = true;
      console.log(user);
      $scope.selectedUser = {
        name : user.name,
        gravatar : user.pic,
        uid : user.uid,
        history: []
      };
      
      var ref = new Firebase(FURL);
      var startTime = new Date().getTime();
      var endTime = startTime - 86400000;
      console.log(startTime);


      ref.child('team').child($scope.team.name).child('all').child(user.uid).orderByChild('time').startAt(endTime).once('value',function(data){
        data = data.val();
        console.log(data);
        var keys = Object.keys(data);
        for(var i = 0; i < keys.length; i++){
          $scope.selectedUser.history.push(data[keys[i]]);
        }
        
        $scope.$apply();
      });
    }

    $scope.init = function(){
      var ref = new Firebase(FURL);
      console.log(Auth.user);
      ref.child('profile').child(Auth.user.uid).child('curTeam').once('value',function(data){
        data = data.val();
        $scope.team.name = data;
        console.log('sup');
        $scope.checkPlanStatus($scope.team.name);
        $scope.checkStatus();

      })
    }


  $scope.init();

  });
