'use strict';

angular.module('webappApp')
  .controller('MainCtrl', function ($scope, $http, stripe, Auth, Phased, FURL,amMoment,toaster, $location) {
    ga('send', 'pageview', '/team');
    $scope.showMember = false;
    $scope.team = Phased.team;
    $scope.viewType = Phased.viewType;

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


    $scope.addMembers = function(names){
    ga('send', 'event', 'Team', 'Member added');
    //_gaq.push(['_trackEvent', 'Team', 'Add member']);
  	var ref = new Firebase(FURL);
    var invited = names;
    var inviter = $scope.team.members[Auth.user.uid];


    //Brian's better add member function
    // find if memeber is already in db
    console.log(names.email);
    new Firebase(FURL+"/profile").orderByChild("email").startAt(invited.email).endAt(invited.email).limitToFirst(1).once('value',function(user){
      user = user.val();
      console.log(user);
      if(user){
        //console.log('invite sent to current user');
        var k = Object.keys(user);
        ref.child('team-invite-existing-member').push({teams : { 0 : Auth.team},email : invited.email, inviteEmail: $scope.currentUser.email, inviteName: $scope.currentUser.name });
        ref.child('profile').child(k[0]).child('teams').push(Auth.team);
      }else{
        //console.log('invited is not a current user, looking to see if they are in profile-in-waiting');

        new Firebase(FURL+"/profile-in-waiting").orderByChild("email").startAt(invited.email).endAt(invited.email).limitToFirst(1).once('value',function(user){
          user = user.val();
    
          if(user){
            //console.log('invite sent to user in profile-in-waiting');

            var y = Object.keys(user);
            ref.child('profile-in-waiting').child(y[0]).child('teams').push(Auth.team);
          }else{
            //console.log('invited is new to the system setting up profile-in-waiting');

            ref.child('profile-in-waiting').push({'teams' : { 0 : $scope.team.name}, 'email' : invited.email, 'inviteEmail': inviter.email, 'inviteName': inviter.name });
            ref.child('profile-in-waiting2').push({'teams' : { 0 : $scope.team.name}, 'email' : invited.email, 'inviteEmail': inviter.email, 'inviteName': inviter.name });
          }
        });
      }
    });
    //close modal
    $('#myModal').modal('toggle');
  };

  $scope.addMemberModel = function(){
    ga('send', 'event', 'Modal', 'Member add');
    $('#myModal').modal('toggle');
  }


});
