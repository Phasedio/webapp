'use strict';

angular.module('webappApp')
  .controller('ProfileCtrl', function ($scope, $http, stripe, Auth, FURL,amMoment) {
    $scope.team = {
      name : '',
      members : {},
      history : [],
      categorySelect : [],
      categoryObj : {}
    };

    new Firebase(FURL).child('profile').child(Auth.user.uid).once('value', function(user) {
      user = user.val();
      $scope.currentUser = user;
    });

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

    $scope.init = function(){
      var ref = new Firebase(FURL);
      console.log(Auth.user);
      ref.child('profile').child(Auth.user.uid).child('curTeam').once('value',function(data){
        data = data.val();
        $scope.team.name = data;
        console.log('sup');
        //$scope.checkPlanStatus($scope.team.name);
        $scope.getCategories();
        //$scope.checkStatus();

      })
    };


    $scope.init();
  });
