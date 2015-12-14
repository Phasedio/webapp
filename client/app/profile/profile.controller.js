'use strict';

angular.module('webappApp')
  .controller('ProfileCtrl', function ($scope,$routeParams, $http, stripe, Auth, Phased, FURL,amMoment,$location) {
    ga('send', 'pageview', '/profile');

    $scope.phased = Phased;
    $scope.team = Phased.team;
    $scope.viewType = Phased.viewType;
    $scope.taskStatuses = Phased.TASK_STATUSES;
    $scope.taskPriorities = Phased.TASK_PRIORITIES;

    // Check to see if there are route perams for this page if so load up that user
    var profileUser;
    if ($routeParams.userid) profileUser = $routeParams.userid;
    else profileUser = Auth.user.uid;

    $scope.currentUser = Phased.team.members[profileUser];
    Phased.watchMemberStream(profileUser);
    Phased.watchMemberAssignments(profileUser);

    $scope.$on('Phased:setup', function(){
      $scope.currentUser = Phased.team.members[profileUser];
      $scope.$apply();
    });
    $scope.$on('Phased:history', function(){
      $scope.$apply();
    });

    // Background image
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

  // bootstrap enable tabs

  $('#myTabs a').click(function (e) {
    e.preventDefault()
    $(this).tab('show')
  });
  // prevent Update
  $scope.person = false;
  if(profileUser == Auth.user.uid) $scope.person = true;
  else $scope.person = false;


  //logout

  $scope.logout = function(){
      console.log('logging you out');
      Auth.logout();
      $location.path('/login');
    }

  // Update Account
  $scope.updateUser = function(update){
    var toaster = { pop : function(a) { console.log(a) } }; // patch while the toaster disappeared!
    if (update.email === undefined || update.email === '') {
      update.email = $scope.currentUser.email;
    }
    if (update.tel !== $scope.currentUser.tel) {
      console.log('hit the tel!');
      Auth.changeTel(update, Auth.user.uid);
      toaster.pop('success', "Your phone number has been updated");
      $scope.currentUser.tel = update.tel;
    }

    if (update.name === $scope.currentUser.name || update.name === undefined || update.name === ''){
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
          $scope.currentUser.email = update.email;
        }
      }
    } else {
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
});
