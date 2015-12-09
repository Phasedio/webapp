'use strict';

angular.module('webappApp')
  .controller('MainCtrl', function ($scope, $http, stripe, Auth, FURL,amMoment,toaster, $location) {
    ga('send', 'pageview', '/team');
    $scope.showMember = false;
    $scope.team = {
      name : '',
      members : {},
      history : [],
      categorySelect : [],
      categoryObj : {}
    };
    $scope.viewType = 'notPaid';

    $scope.selectedUser = {
        name : '',
        gravatar : '',
        uid : '',
        history: []
      };

      var monImage =  "weekdayPhotos/mon.jpg";
    var tuesImage =  "weekdayPhotos/tues.jpg";
    var wedImage =  "weekdayPhotos/wed.jpg";
    var thursImage =  "weekdayPhotos/thurs.jpg";
    var friImage = "weekdayPhotos/fri.jpg";
    var satImage = "weekdayPhotos/sat.jpg";
    var sunImage = "weekdayPhotos/sun.jpg";

    var d=new Date();
    console.log(d.getDay());



    var backgroundImage = [sunImage, monImage, tuesImage, wedImage, thursImage, friImage, satImage];
    $scope.dayImage = backgroundImage[d.getDay()];
    /**
    *
    * goToMemeber(uid)
    * sends user to profile of user
    */
    $scope.goToUser = function(uid){
      $location.path('/profile/'+uid);
    }

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
      ga('send', 'event', 'Team', 'View user');
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


    $scope.addMembers = function(names){
    ga('send', 'event', 'Team', 'Member added');
    //_gaq.push(['_trackEvent', 'Team', 'Add member']);
  	var ref = new Firebase(FURL);
    // grab all users and see if they match an email in the system

    ref.child('profile').once('value', function(data){
      data = data.val();

      var selectedUID = Object.keys(data);
      var isSet = false;

      // if this email matches the one from the profile page assign this team to their account
      for(var y = 0; y < selectedUID.length; y++){
        console.log('test3');
        if(names.email == data[selectedUID[y]].email){
          isSet = true;
          //get the key of the uid

          //save to new node so that zapier can email.
          ref.child('team-invite-existing-member').push({teams : { 0 : Auth.team},email : names.email, inviteEmail: $scope.currentUser.email, inviteName: $scope.currentUser.name });

          //push new team to member
          ref.child('profile').child(selectedUID[y]).child('teams').push(Auth.team);
          break;
        }
      }
      // if no matches are found create a profile-in-waiting with this team assigned.
      if(!isSet){
        console.log(names.email, $scope.currentUser);

        // loop profile-in-waiting to find a match
        ref.child('profile-in-waiting').once('value', function(data){
          data = data.val();
          var selectedUID = Object.keys(data);
          var thisSet = false;
          for(var y = 0; y < selectedUID.length; y++){
            console.log(data[selectedUID[y]].email);
            if(names.email == data[selectedUID[y]].email){
              thisSet = true;
              //check if email already has team attached
              var userTeams = Object.keys(data[selectedUID[y]].teams);
              var profileOfUser = data[selectedUID[y]];
              var change = false;

              for(var u = 0; u < userTeams.length; u++){
                if(profileOfUser.teams[userTeams[u]] == Auth.team){
                  break;
                }else{
                  change = true;
                  break;
                }
              }
              if(change){
                //push new team to member
                ref.child('profile-in-waiting').child(selectedUID[y]).child('teams').push(Auth.team);
                //sendTheMail(msg);
                break;
              }
            }
          }
          if(!thisSet){
            ref.child('profile-in-waiting').push({teams : { 0 : Auth.team},email : names.email, inviteEmail: $scope.currentUser.email, inviteName: $scope.currentUser.name });
            ref.child('profile-in-waiting2').push({teams : { 0 : Auth.team},email : names.email, inviteEmail: $scope.currentUser.email, inviteName: $scope.currentUser.name });


            //sendTheMail(msg);
          }
        });
      }
    });
	$('#myModal').modal('toggle');

  };
  $scope.addMemberModel = function(){
    ga('send', 'event', 'Modal', 'Member add');
    $('#myModal').modal('toggle');
  }


    $scope.init = function(){
      var ref = new Firebase(FURL);
      console.log(Auth.user);
      ref.child('profile').child(Auth.user.uid).child('curTeam').once('value',function(data){
        data = data.val();
        $scope.team.name = data;
        console.log('sup');
        //$scope.checkPlanStatus($scope.team.name);
        $scope.getCategories();
        $scope.checkStatus();

      })
    }


  $scope.init();

  });
