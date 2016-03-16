'use strict';

angular.module('webappApp')
  .provider('Auth', function() {

    this.$get = ['FURL', '$firebaseAuth', '$firebase', '$firebaseObject', '$location', '$window', '$rootScope', 'toaster', '$http',
        function (FURL, $firebaseAuth, $firebase, $firebaseObject, $location, $window, $rootScope, toaster, $http) {
            return new AuthProvider(FURL, $firebaseAuth, $firebase, $firebaseObject, $location, $window, $rootScope, toaster, $http);
        }];

    // array of callbacks to execute after auth is finished
    var doAfterAuth = [];

    /**
    *
    *   adds a callback to doAfterAuth[]; can only be used
    *   in module.config() blocks
    *   Callbacks are executed after Auth is finished and passed the Auth object
    *
    */
    this.setDoAfterAuth = function (newDAA) {
        doAfterAuth.push(newDAA);
    }

    // executes all registered callbacks after auth is complete
    // this is very important for making other providers that rely on Auth (currently, only Phased) to run
    var doAllAfterAuth = function(Auth) {
        for (var i in doAfterAuth) {
            doAfterAuth[i](Auth);
        }
    }

    // AngularJS will instantiate a singleton by calling "new" on this function
    var AuthProvider = function(FURL, $firebaseAuth, $firebase,$firebaseObject, $location, $window, $rootScope, toaster, $http) {
        var ref = new Firebase(FURL);
        var auth = $firebaseAuth(ref);

        var Auth = {
            user: {},
            fb : auth,
            newTeam : false,
            login: function(user, success, failure) {
                if (typeof success == 'undefined')
                    var success = function() {};
                if (typeof failure == 'undefined')
                    var failure = function() {};

                auth.$authWithPassword(
                    {email: user.email, password: user.password}
                ).then(
                    function(authData) {
                        if (!('uid' in authData)) {
                            failure(authData);
                            return;
                        } else {
                            angular.copy(authData, Auth.user);
                            getProfileDetails(Auth.user.uid, authData.provider)
                                .then(success, authData);
                        }
                    },
                    function(err) {
                        failure(err);
                    }
                );
            },
            /*
            	Authenticate with GitHub provider

							This presents some difficulties with FireBase, since it overwrites the FB session
							This function sets up some mappings which allow users authenticated with GH to access
								their previously authenticated account.

							NB: the user's Auth data STAYS THE SAME locally

            	1 stash profile/oldUID/mappings[newProvider] = 'authenticating'
            	2 auth with github
            	3 stash userMapping[newUID] = oldUID (only works if 'authenticating' == profile/oldUID/mappings[newProvider])
            	4 stash profile/oldUID/mappings[newProvider] = newUID
            	5 stash alias to team if Auth.curTeam is set
            */
            githubLogin : function(success, failure) {
            	var fail = function(err){
            		console.trace(err);
            		if (typeof failure == "function")
            			failure(error);
            	}

            	// 3 & 4
            	var authSuccess = function(authData) {
            		var newUID = authData.uid,
            		oldUID = Auth.user.uid;
            		Auth.user.github = authData.github;
        				// 3.
        				ref.child('userMappings/' + newUID).set(oldUID, function(err){
        					if (err) return fail(err);
        					// 4.
        					ref.child('profile/' + oldUID + '/mappings/github/').set(newUID, function(err){
        						if (err) return fail(err);
        						if (typeof success == "function") return success(authData.github);
        					})
        				});

        				// 5. 
        				if (Auth.currentTeam) {
        					ref.child('team/' + Auth.currentTeam + '/members/' + oldUID + '/aliases/github/0')
        						.set(authData.github.username);
        				}
            	}

            	// 1
            	ref.child('profile/' + Auth.user.uid + '/mappings/github').set('authenticating', function(err){ if (err) return fail(err); });
            	
            	// 2.
            	ref.authWithOAuthPopup("github", function(error, authData) {
            		if (error) {
            			ref.authWithOAuthRedirect('github', function(error, authData) {
            				if (error) return fail(error);
            				else authSuccess(authData);
            			});
            		} else {
            			authSuccess(authData);
            		}
            	}, {
            		scope: 'user,repo'
            	});
            	
            },
            register : function(user) {
                user.email = user.email.toLowerCase();
                $post.post('./api/registration/register', {
                    user: JSON.stringify(user)
                })
                .then(function(data) {
                    if (data.success) {
                        console.log('success', data);
                        Auth.login(user);
                    } else {
                        console.log('err', data);
                    }
                }, function(data){
                    console.log('err', data);
                });
            },
            logout: function() {
                console.log('logged out');
                auth.$unauth();
            },
            changePassword : function(user) {
                return auth.$changePassword({email: user.email, oldPassword: user.oldPass, newPassword: user.newPass});
            },
            changeEmail : function(user, uid) {
              // console.log('will change email', user, uid);
              var profile = ref.child("profile").child(uid).child('email').set(user.email);

            },
            changeName: function(user, uid){
              // console.log('will change name', user.name);
              var profile = ref.child("profile").child(uid).child('name').set(user.name);
            },
            changeTel: function(user, uid){
              console.log('will change tel', user.tel);
              if (isValidNumber(user.tel, 'CA'))
                user.tel = formatE164('CA', user.tel);
              else
                return false;

              var profile = ref.child("profile/" + uid + '/tel').set(user.tel, function(err){
                // after updating, send a welcome SMS
                ref.child('newTel').push(user.tel);
              });

              return true;
            },
            signedIn: function() {
                return !!Auth.user.provider;
            },
            createTeam : function(name,uid){
              Auth.newTeam = true;
              var teamMaker = makeTeam(name,uid);
              return teamMaker;
            },
            currentTeam : ''
        };


        /**
        *
        *   fills in Auth.user with variables from /profile/$uid
        *   then calls the doAfterAuth callbacks
        *   then calls its own callbacks (set in a pseudo-Promise)
        *
        */
        var getProfileDetails = function(uid, provider) {
            // where pseudo-promise is kept
            getProfileDetails.then = function() {};
            getProfileDetails.args = {};
            // below is returned
            var pseudoPromise = {
                then : function(doAfter, args) {
                    if (doAfter)
                        getProfileDetails.then = doAfter;
                    if (args)
                        getProfileDetails.args = args;
                }
            }

            // get account data
            var fillProfile = function (snapshot) {
            	var user = snapshot.val();
            	if (user) {
            		Auth.user.profile = user;
            		Auth.currentTeam = user.curTeam;
            		mixpanel.identify(Auth.user.uid);
            		mixpanel.people.set({
	                "$email": user.email,    // only special properties need the $
	                "$last_login": new Date(),         // properties can be dates...
	                "team" : user.curTeam
	              });
		            // if user isn't currently on a team
		            if (!user.curTeam) {
	                // if the user has teams, set the first one to active
	                if ( user.teams ) {
	                  Auth.currentTeam = user.teams[Object.keys(user.teams)[0]]; // first of the user's teams
	                  ref.child('profile/' + Auth.user.uid + '/curTeam').set(Auth.currentTeam);
	                } else {
	                  // if the user doesn't have teams, main.controller will prompt to add one
	                  Auth.currentTeam = false;
	                }
	              }
                doAllAfterAuth(Auth);
                getProfileDetails.then(getProfileDetails.args);
                $rootScope.$broadcast('Auth:authenticated');
              } else {
              	console.trace('Grave error, user ' + Auth.user.uid + ' does not exist');
              	$location.path('/login');
              }
            }

            // if the account is a normal account, get the profile right away
            if (provider == 'password')
            	ref.child('profile/' + uid).once('value', fillProfile);
            else if (provider) {
            	// otherwise we have to get the user's proper ID first
            	ref.child('userMappings/' + uid).once('value', function(snap){
            		var properID = snap.val();
            		if (properID) {
            			Auth.user.providerUID = Auth.user.uid + ''; // back it up just in case
            			Auth.user.uid = properID;
            			// now that we have the proper ID, we can continue with filling out the profile datas
            			ref.child('profile/' + properID).once('value', fillProfile);
            		} else {
            			console.trace('Grave error: user has not registered with password or could not be found; login abort');
            			$location.path('/login');
            		}
            	});
            } else {
            	console.trace('Grave error: no provider');
        			$location.path('/login');
            }

            // return the pseudo-promise
            return pseudoPromise;
        }


        /**
        *
        *   makes a new team, adds current user to it, makes them Owner
        *   1. if team exists, add user to it as member
        *   2. if doesn't exists,
        *       A. make it
        *       B. add user to it as owner
        *
        */
        var makeTeam = function(teamName, id) {
            // adds a member to a team
            var addMemberToTeam = function(teamID, role) {
                // 1. adds to team/$team/members with role (defaults to member)
                var role = role || 0; // 0 == member
                ref.child('team/' + teamID + '/members/' + id).set({role : role});

                // 2. adds to profile/$uid/teams
                ref.child('profile/' + id + '/teams').push(teamID);

                // 3. sets profile/$uid/curTeam
                ref.child('profile/' + id + '/curTeam').set(teamID);
            } // end addMemberToTeam()

            // if Auth knows we're making a new team
            if (Auth.newTeam) {
                // 1. check that it exists
                ref.child('team').orderByChild('name').equalTo(teamName)
                .once('value', function(snapshot) {
                    var team = snapshot.val();
                    var teamID = snapshot.key();

                    // if it doesn't exists
                    if (!team) {
                        // make it
                        var newTeamRef = ref.child('team').push({ name : teamName });
                        // add member to it
                        addMemberToTeam(newTeamRef.key(), 2); // 2 == owner
                    }
                    // if it does exist
                    else {
                        if (!id in team.members)
                            addMemberToTeam(teamID); // as member
                    }
                });
            }
        };


        /**
        *   INIT
        */

        // listen for auth state changes
        // if logged in and on /login, go to /
        // if logging out (or session timeout!), go to /login
        // else do nothing
        auth.$onAuth(function(authData) {
						// attach FB token to Authorization header
						$http.defaults.headers.post.Authorization = 'Bearer ' + authData.token;

            var path = '';
            // if not authenticated, go to /login
            if (!authData) {
                path = '/login';
            }
            // if authenticated on the login screen, go to /
            else if ($location.path() == '/login') {
                path = '/';
            }
            // do nothing if authenticated within the app
            else {
                return;
            }

            // go places
            $rootScope.$apply(
                function() {
                    $location.path(path);
                }
            );
        });

        // get user account metadata if already logged in
        var authData = auth.$getAuth();
        if (authData) {
        	// attach FB token to Authorization header
					$http.defaults.headers.post.Authorization = 'Bearer ' + authData.token;
          angular.copy(authData, Auth.user);
          getProfileDetails(Auth.user.uid, authData.provider); // go to app after getting details
        
        }

        return Auth;
    }

  });
