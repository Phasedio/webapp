'use strict';

angular.module('webappApp')
  .filter('tel', function() {
    return function(tel) {
      var res = formatLocal('CA', tel);
      return res || tel;
    }
  })
  /*
    Basically a length property that will also count objects
  */
  .filter('length', function(){
    return function(input) {
      return Object.keys(input).length;
    }
  })
  /*
    Gets updates for a user
  */
  .filter('updatesFor', function() {
    return function(input, uid) {
      var out = {};
      // for each status
      for (var i in input) {
        // if both a user is specified and it matches the user, add to output array
        if (typeof uid == 'string' && input[i].user === uid) {
          out[i] = input[i];
        }
      }

      return out;
    }
  })
  /*
    get updates during a specified period ('today' or 'week')
    1. sets after and before vars depending on period
    2. checks each update's time attribute to see if it's between them
  */
  .filter('updatesForTime', function() {
    // get midnight timestamp outside of returned function so we don't have to do the calculation each digest
    var today = [new Date().getDate(),new Date().getMonth(),new Date().getFullYear()];
    var midnight = new Date(today[2],today[1],today[0]).getTime();
    var tomorrow = midnight + 86400000;
    var weekOffSet = midnight - ((new Date(midnight).getDay()) * 86400000 * 7);

    return function(input, since) {
      var out = {};
      var after, before;

      // 1. determine range
      if (since == 'today') {
        after = midnight;
        before = tomorrow;
      } else if (since == 'week') {
        after = weekOffSet;
        before = midnight;
      } else {
        return input;
      }

      // 2. check each update
      for (var i in input) {
        if (input[i].time >= after && input[i].time < before) {
          out[i] = input[i];
        }
      }

      return out;
    }
  })
  /*
    gets a list of incomplete tasks assigned to a user
  */
  .filter('backlogFor', ['Phased', function(Phased) {
    return function(input, uid) {
      var out = {};

      // for each task
      for (var i in input) {
        // if isn't finished and both a user is specified and it matches the user, add to output array
        if (input[i].status != Phased.task.STATUS_ID.COMPLETE &&
          (typeof uid == 'string' && input[i].assigned_to === uid)) {
          out[i] = input[i];
        }
      }

      return out;
    }
  }])
  /*
    gets a list of tasks assigned to a user
  */
  .filter('tasksFor', function() {
    return function(input, uid) {
      var out = {};

      // for each task
      for (var i in input) {
        if (typeof uid == 'string' && input[i].assigned_to === uid) {
          out[i] = input[i];
        }
      }

      return out;
    }
  })
  /*
    gets a list of tasks completed within a specified period ('today', 'week', or 'ever')
  */
  .filter('tasksCompletedForTime', ['Phased', function(Phased) {
    var today = [new Date().getDate(),new Date().getMonth(),new Date().getFullYear()];
    var midnight = new Date(today[2],today[1],today[0]).getTime();
    var tomorrow = midnight + 86400000;
    var weekOffSet = midnight - ((new Date(midnight).getDay()) * 86400000 * 7);

    return function(input, since) {
      var out = {};
      var after, before;

      if (since == 'today') {
        after = midnight;
        before = tomorrow;
      } else if (since == 'week') {
        after = weekOffSet;
        before = midnight;
      } else if (since == 'ever') {
        after = 0;
        before = tomorrow;
      } else {
        return input;
      }

      // for each task
      for (var i in input) {
        if (input[i].status == Phased.task.STATUS_ID.COMPLETE &&
          input[i].completeTime >= after && input[i].completeTime < before) {
          out[i] = input[i];
        }
      }

      return out;
    }
  }])
  .controller('ProfileCtrl', function ($scope,$routeParams, $http, stripe, Auth, Phased, FURL,amMoment,$location) {
    ga('send', 'pageview', '/profile');

    $scope.phased = Phased;
    $scope.team = Phased.team;
    $scope.viewType = Phased.viewType;

    // Check to see if there are route perams for this page if so load up that user
    var profileUser;
    if ($routeParams.userid) profileUser = $routeParams.userid;
    else profileUser = Auth.user.uid;

    $scope.currentUser = Phased.team.members[profileUser];
    $scope.currentUserID = profileUser;

    $scope.$on('Phased:setup', function(){
      $scope.currentUser = Phased.team.members[profileUser];
    });

    var FBRef = new Firebase(FURL);

    // bootstrap enable tabs
    $('#myTabs a').click(function (e) {
      e.preventDefault()
      $(this).tab('show')
    });

    // prevent Update
    $scope.person = false;
    if (profileUser == Auth.user.uid) $scope.person = true;
    else $scope.person = false;

    // logout
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
        if (Auth.changeTel(update, Auth.user.uid)) {
          toaster.pop('success', "Your phone number has been updated");
          $scope.currentUser.tel = update.tel;
        } else {
          toaster.pop('error', 'Invalid phone number');
        }
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
