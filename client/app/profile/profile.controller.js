'use strict';

angular.module('webappApp')
  .controller('ProfileCtrl', function ($scope,$routeParams, $http, stripe, Auth, FURL,amMoment) {
    ga('send', 'pageview', '/profile');
    $scope.team = {
      name : '',
      members : {},
      history : [],
      categorySelect : [],
      categoryObj : {},
      backlog : []
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

  // Check to see if there are route perams for this page if so load up that user
  var profileUser;
  if($routeParams.userid){
    profileUser = $routeParams.userid;
  }else{
    profileUser = Auth.user.uid;
  }
  console.log($routeParams);

  // Update Account
  $scope.updateUser = function(update){
    if(update.email === undefined || update.email === ''){
      update.email = $scope.currentUser.email;
    }

    if(update.name === $scope.currentUser.name || update.name === undefined || update.name === ''){
      //console.log("we are changing the password");
      if(update.oldPass && update.newPass){
        console.log('we will change the password');
        Auth.changePassword(update).then(function (){
          console.log('will change password');
          toaster.pop('success', "Your password has been changed!");
        }, function(err) {
          console.log('error', err);
          if (err == "Error: The specified password is incorrect.") {
            console.log("we are here");
            toaster.pop('error', 'Your current password is incorrect');
          } else {
            toaster.pop('error', 'Your email is incorrect! Make sure you are using your current email');
          }

        });
      } else {
        console.log('changing email');
        console.log(update.email);
        if (update.email !== $scope.currentUser.email) {
          console.log('we are changing the email', Auth.user.uid);
          Auth.changeEmail(update, Auth.user.uid);
          toaster.pop('success', "Your email has been updated!");
        }
      }
    }else {
      console.log('changing userName or email');
      console.log(update.email);
      if (update.name !== $scope.currentUser.name) {
        Auth.changeName(update, Auth.user.uid);

        new Firebase(FURL).child('profile').child(Auth.user.uid).once('value', function(user) {
          user = user.val();

          console.log(user);
          console.log(Auth.user.uid);
        });

        toaster.pop('success', "Your name has been updated!");
      }
      if (update.email !== $scope.currentUser.email) {
        Auth.changeEmail(update, Auth.user.uid);
        toaster.pop('success', "Your email has been updated!");
      }
    }
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
    $scope.viewUser = function(){
      var ref = new Firebase(FURL);
      var startTime = new Date().getTime();
      var endTime = startTime - 86400000;
      console.log(startTime);
      ref.child('team').child($scope.team.name).child('all').child(profileUser).orderByChild('time').startAt(endTime).once('value',function(data){
        data = data.val();
        console.log(data);
        var keys = Object.keys(data);
        for(var i = 0; i < keys.length; i++){
          $scope.team.history.push(data[keys[i]]);
        }
        console.log($scope.team.history);
        $scope.$apply();
      });
    }


    /**
    *
    * Get tasks assigned to this user and show it as their backlog
    *
    */

    $scope.getBacklog = function(){
      // go to FB and check if user has any tasks assigned to them.
      var ref = new Firebase(FURL);
      ref.child('team').child($scope.team.name).child('assignments').child('to').child(profileUser).once('value',function(data){
        data = data.val();
        // if data then there are tasks
        if(data){
          // This could probably be done from a service better.
          var assignedTasks = data;
          var assignedKeys = Object.keys(data);
          var backlog = [];
          ref.child('team').child($scope.team.name).child('assignments').child('all').once('value',function(data){
            data = data.val();
            for (var i = 0; i < assignedKeys.length; i++) {
              backlog.push(data[assignedTasks[assignedKeys[i]]]);
            }
            console.log(backlog);
            $scope.team.backlog = backlog;
          });
        }
        // Else this person is lazy and should be assigned all the tasks forever.
      });


    }


    $scope.init = function(){
      var ref = new Firebase(FURL);
      console.log(Auth.user);


      ref.child('profile').child(profileUser).child('curTeam').once('value',function(data){
        data = data.val();
        $scope.team.name = data;
        console.log('sup');
        //Get history for this user... This is baaaaaaaaaad
        new Firebase(FURL).child('profile').child(profileUser).once('value', function(user) {
          user = user.val();
          $scope.currentUser = user;
          $scope.viewUser();
        });
        //$scope.checkPlanStatus($scope.team.name);
        $scope.getCategories();
        $scope.getBacklog();

        //$scope.checkStatus();

      })
    };


    $scope.init();
  });
