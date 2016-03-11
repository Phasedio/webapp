'use strict';

angular.module('webappApp')
.filter('orderObjectBy', function() {
return function(items, field, reverse) {
  var filtered = [];
  for (var i in items) {
    items[i].key = i;
    items[i].lastUpdated = items[i].currentStatus.time;
    filtered.push(items[i]);
  }
  filtered.sort(function (a, b) {
    return (a[field] > b[field] ? 1 : -1);
  });
  if(reverse) filtered.reverse();
  //console.log(filtered);
  return filtered;
};
})
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
    console.log(Phased.team);
    var ref = new Firebase(FURL);

    // bounce users if team has problems
    var checkTeam = function(){
      // do only after Phased is set up
      if (!Phased.SET_UP) {
        $scope.$on('Phased:setup', checkTeam);
        return;
      }
      var teamCheck = Phased.viewType;
      console.log(teamCheck);
      if (teamCheck == 'problem'){
        $location.path('/team-expired');
      }else if (teamCheck == 'canceled') {
        $location.path('/switchteam');
      }

    }
    $scope.$on('Phased:PaymentInfo', checkTeam);
    checkTeam();

    // fills profile for the selected user
    // must be done AFTER Auth and Phased are set up
    // in case the user is logged in with another service
    // (Auth replaces the user's OAuth provider id with their 
    // "proper" id)
		var initProfileUser = function() {
			// do only after Phased is set up
			if (!Phased.SET_UP) {
				$scope.$on('Phased:setup', initProfileUser);
				return;
			}
			// Check to see if there are route perams for this page if so load up that user
			if ($routeParams.userid)
				$scope.currentUserID = $routeParams.userid;
			else {
				$scope.currentUserID = Auth.user.uid;
			}

			$scope.currentUser = Phased.team.members[$scope.currentUserID];

			// prevent Update
			$scope.isSelf = ($scope.currentUserID == Auth.user.uid);
		}
		initProfileUser();

    // bootstrap enable tabs
    $('#myTabs a').click(function (e) {
      e.preventDefault()
      $(this).tab('show')
    });


    // logout
    $scope.logout = function(){
      console.log('logging you out');
      Auth.logout();
      $location.path('/login');
    }

    //Photo stuff
    //console.log(Auth.user);
 //document.getElementById("file-upload").addEventListener('change', handleFileSelect, false);
 $scope.handleFileSelect = function(evt) {
   console.log(evt);
  //  var f = evt.target.files[0];
  //  var reader = new FileReader();
   //
  //  console.log('the reader is ', reader);
  //  reader.onload = (function(theFile) {
  //    return function(e) {
  //      var gravatar = e.target.result;
  //      // Generate a location that can't be guessed using the file's contents and a random number
  //      //var hash = CryptoJS.SHA256(Math.random() + CryptoJS.SHA256(gravatar));
  //      var f = ref.child('profile').child(Phased.user.uid).child('gravatar');
  //      f.set(gravatar, function() {
  //        //document.getElementById("pano").src = e.target.result;
  //        $('#file-upload').hide();
   //
  //        // Update the location bar so the URL can be shared with others
  //        //window.location.hash = hash;
   //
  //      });
  //    };
  //  })(f);
  //  reader.readAsDataURL(f);
 }

 $scope.changeImage = function(){
    var f = $("#file-upload")[0].files[0];
    console.log(f);
    if(f.size < 2097152){
      //var f = document.getElementById("file-upload").value;
      var reader = new FileReader();
      reader.onload = (function(theFile) {
        return function(e) {

          var gravatar = e.target.result;
          console.log(gravatar);
          // Generate a location that can't be guessed using the file's contents and a random number
          //var hash = CryptoJS.SHA256(Math.random() + CryptoJS.SHA256(gravatar));
          var f = ref.child('profile').child(Phased.user.uid).child('gravatar');
          f.set(gravatar, function() {
            mixpanel.track("Changed Profile Image");
            //document.getElementById("pano").src = e.target.result;
            $('#file-upload').hide();

            // Update the location bar so the URL can be shared with others
            //window.location.hash = hash;

          });


        };
      })(f);
      reader.readAsDataURL(f);
    }


 }


    // Update Account
    $scope.updateUser = function(update){
      mixpanel.track("Update user settings");
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
