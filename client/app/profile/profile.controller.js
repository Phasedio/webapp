'use strict';

angular.module('webappApp')
	// .filter('orderObjectBy', function() {
	// 	return function(items, field, reverse) {
	// 	  var filtered = [];
	// 	  for (var i in items) {
	// 	    items[i].key = i;
	// 	    items[i].lastUpdated = items[i].currentStatus.time;
	// 	    filtered.push(items[i]);
	// 	  }
	// 	  filtered.sort(function (a, b) {
	// 	    return (a[field] > b[field] ? 1 : -1);
	// 	  });
	// 	  if(reverse) filtered.reverse();
	// 	  //console.log(filtered);
	// 	  return filtered;
	// 	};
	// })

  .controller('ProfileCtrl', function ($scope,$routeParams, $http, Auth, Phased, FURL,amMoment,$location) {
    ga('send', 'pageview', '/profile');

    $scope.phased = Phased;
    $scope.team = Phased.team;
    $scope.viewType = Phased.viewType;
    $scope.update = {
    	aliases : {}
    };
    $scope.calendarList = false; // where calendars will be held
    var ref = new Firebase(FURL);

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

			// get calendars if isSelf and self is authed with google
			Phased.getGoogleCalendars(function(res) {
				$scope.calendarList = res;
			});
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

    // LAZY LOADING LIST
    $scope.loadMoreStatuses = function(e) {
    	e.preventDefault();
    	Phased.getStatusesPage();
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

		// GOOGLE CAL INTEGRATION

		// check user's auth state every time the panel is hit
		Phased.checkGoogleAuth();

		// starts google Auth process
		$scope.startGoogleAuth = function(e) {
			e.preventDefault();
			Auth.googleLogin();
		}

		$scope.getCals = function(e) {
			e.preventDefault();
			Phased.getGoogleCalendars(function(res) {
				$scope.calendarList = res;
			}); // get google calendars if user is authenticated
		}

		// click handler to toggle calendar registration
		$scope.toggleCalRegistered = function(cal, e) {
			e.preventDefault();
			if ( $scope.isCalRegistered(cal) ) {
				Phased.deregisterGoogleCalendar(cal);
			} else {
				Phased.registerGoogleCalendar(cal);
			}
		}

		$scope.isCalRegistered = function(cal){
			return cal.id in Phased.user.registeredCalendars;
		}

    // Update Account
    $scope.updateUser = function(update){
      mixpanel.track("Update user settings");
      if (update == undefined) return; // update nothing? do nothing.

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

      // only update github alias if different
      if (update.aliases.github && update.aliases.github[0] != $scope.currentUser.aliases.github[0]) {
      	Phased.updateGHAlias(update.aliases.github[0], 0);
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
