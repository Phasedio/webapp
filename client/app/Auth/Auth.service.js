'use strict';

angular.module('webappApp')
  .provider('Auth', function() {

    this.$get = ['FURL', '$firebaseAuth', '$firebase', '$firebaseObject', '$location', '$rootScope', 'toaster',
        function (FURL, $firebaseAuth, $firebase,$firebaseObject,$location,$rootScope, toaster) {
            return new AuthProvider(FURL, $firebaseAuth, $firebase,$firebaseObject,$location,$rootScope, toaster);
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
    var AuthProvider = function(FURL, $firebaseAuth, $firebase,$firebaseObject,$location,$rootScope, toaster) {
        var ref = new Firebase(FURL);
        var auth = $firebaseAuth(ref);

        var Auth = {
            user: {},
            fb : auth,
            newTeam : false,
            /**
            *   Creates a new profile for a user coming to the site
            *
            *   1. check if profile-in-waiting has been set up by some team admin
            *       1B - if so, add to those teams
            *   2. create profile
            *
            */
            createProfile: function(uid, user) {
                // 1.
                return ref.child('profile-in-waiting').orderByChild('email').equalTo(user.email).once('value', function(snap){
                    var data = snap.val();
                    var profile = {
                        name: user.name,
                        email: user.email,
                        gravatar: get_gravatar(user.email, 40),
                        newUser : true
                    };

                    if (data) {
                        // get profile-in-waiting (PIW)
                        var PIWID = Object.keys(data)[0];
                        var PIW = data[PIWID];

                        // 1B.
                        profile.teams = PIW.teams; // add to user's own teams
                        for (var i in PIW.teams) {
                            // add to team member list
                            ref.child('team/' + PIW.teams[i] + '/members/' + uid).update({
                                role: 0 // member
                            });
                        }
                    }

                    // 2. create profile and remove PIW
                    ref.child('profile/' + uid).set(profile, function(){
                        Auth.login(user);

                        if (PIWID) {
                            ref.child('profile-in-waiting/' + PIWID).remove();
                        }
                    });
                }, function(err){
                    toaster.pop('error', 'Error', 'Could not create profile...');
                });
            },
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
                            getProfileDetails(Auth.user.uid)
                                .then(success, authData);
                        }
                    },
                    function(err) {
                        failure(err);
                    }
                );
            },
            register : function(user) {
                user.email = user.email.toLowerCase();
                return ref.createUser({email: user.email, password: user.password}, function(err, data) {
                    if (err) {
                        switch (err.code) {
                            case 'EMAIL_TAKEN':
                                toaster.pop('error', 'Error', user.email + ' is already registered.');
                                break;
                            default :
                                toaster.pop('error', 'Error', 'Could not register user.');
                                break;
                        }
                    } else {
                        console.log('no errors, creating profile');
                        Auth.createProfile(data.uid, user);
                    }
                })
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
        var getProfileDetails = function(uid) {
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
            ref.child('profile/' + uid).once('value', function (snapshot) {
                var user = snapshot.val();
                if (user) {
                    Auth.user.profile = user;
                    Auth.currentTeam = user.curTeam;

                    // if user isn't currently on a team
                    if (!user.curTeam) {
                        // if the user has teams, set the first one to active
                        if ( user.teams ) {
                            Auth.currentTeam = user.teams[Object.keys(user.teams)[0]]; // first of the user's teams
                            ref.child('profile/' + uid + '/curTeam').set(Auth.currentTeam);
                        } else {
                            // if the user doesn't have teams, main.controller will prompt to add one
                            Auth.currentTeam = false;
                        }
                    }

                    doAllAfterAuth(Auth);
                    getProfileDetails.then(getProfileDetails.args);
                } else {
                    console.warn('Grave error, user ' + uid + ' does not exist');
                }
            });

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
            angular.copy(authData, Auth.user);
            getProfileDetails(Auth.user.uid); // go to app after getting details
        }

        // get a user's gravatar from their email address
        function get_gravatar(email, size) {
            email = email.toLowerCase();

            var MD5 = function(s) {
                function L(k, d) {
                    return (k << d) | (k >>> (32 - d))
                }

                function K(G, k) {
                    var I, d, F, H, x;
                    F = (G & 2147483648);
                    H = (k & 2147483648);
                    I = (G & 1073741824);
                    d = (k & 1073741824);
                    x = (G & 1073741823) + (k & 1073741823);
                    if (I & d) {
                        return (x ^ 2147483648 ^ F ^ H)
                    }
                    if (I | d) {
                        if (x & 1073741824) {
                            return (x ^ 3221225472 ^ F ^ H)
                        } else {
                            return (x ^ 1073741824 ^ F ^ H)
                        }
                    } else {
                        return (x ^ F ^ H)
                    }
                }

                function r(d, F, k) {
                    return (d & F) | ((~d) & k)
                }

                function q(d, F, k) {
                    return (d & k) | (F & (~k))
                }

                function p(d, F, k) {
                    return (d ^ F ^ k)
                }

                function n(d, F, k) {
                    return (F ^ (d | (~k)))
                }

                function u(G, F, aa, Z, k, H, I) {
                    G = K(G, K(K(r(F, aa, Z), k), I));
                    return K(L(G, H), F)
                }

                function f(G, F, aa, Z, k, H, I) {
                    G = K(G, K(K(q(F, aa, Z), k), I));
                    return K(L(G, H), F)
                }

                function D(G, F, aa, Z, k, H, I) {
                    G = K(G, K(K(p(F, aa, Z), k), I));
                    return K(L(G, H), F)
                }

                function t(G, F, aa, Z, k, H, I) {
                    G = K(G, K(K(n(F, aa, Z), k), I));
                    return K(L(G, H), F)
                }

                function e(G) {
                    var Z;
                    var F = G.length;
                    var x = F + 8;
                    var k = (x - (x % 64)) / 64;
                    var I = (k + 1) * 16;
                    var aa = Array(I - 1);
                    var d = 0;
                    var H = 0;
                    while (H < F) {
                        Z = (H - (H % 4)) / 4;
                        d = (H % 4) * 8;
                        aa[Z] = (aa[Z] | (G.charCodeAt(H) << d));
                        H++
                    }
                    Z = (H - (H % 4)) / 4;
                    d = (H % 4) * 8;
                    aa[Z] = aa[Z] | (128 << d);
                    aa[I - 2] = F << 3;
                    aa[I - 1] = F >>> 29;
                    return aa
                }

                function B(x) {
                    var k = "",
                        F = "",
                        G, d;
                    for (d = 0; d <= 3; d++) {
                        G = (x >>> (d * 8)) & 255;
                        F = "0" + G.toString(16);
                        k = k + F.substr(F.length - 2, 2)
                    }
                    return k
                }

                function J(k) {
                    k = k.replace(/rn/g, "n");
                    var d = "";
                    for (var F = 0; F < k.length; F++) {
                        var x = k.charCodeAt(F);
                        if (x < 128) {
                            d += String.fromCharCode(x)
                        } else {
                            if ((x > 127) && (x < 2048)) {
                                d += String.fromCharCode((x >> 6) | 192);
                                d += String.fromCharCode((x & 63) | 128)
                            } else {
                                d += String.fromCharCode((x >> 12) | 224);
                                d += String.fromCharCode(((x >> 6) & 63) | 128);
                                d += String.fromCharCode((x & 63) | 128)
                            }
                        }
                    }
                    return d
                }
                var C = Array();
                var P, h, E, v, g, Y, X, W, V;
                var S = 7,
                    Q = 12,
                    N = 17,
                    M = 22;
                var A = 5,
                    z = 9,
                    y = 14,
                    w = 20;
                var o = 4,
                    m = 11,
                    l = 16,
                    j = 23;
                var U = 6,
                    T = 10,
                    R = 15,
                    O = 21;
                s = J(s);
                C = e(s);
                Y = 1732584193;
                X = 4023233417;
                W = 2562383102;
                V = 271733878;
                for (P = 0; P < C.length; P += 16) {
                    h = Y;
                    E = X;
                    v = W;
                    g = V;
                    Y = u(Y, X, W, V, C[P + 0], S, 3614090360);
                    V = u(V, Y, X, W, C[P + 1], Q, 3905402710);
                    W = u(W, V, Y, X, C[P + 2], N, 606105819);
                    X = u(X, W, V, Y, C[P + 3], M, 3250441966);
                    Y = u(Y, X, W, V, C[P + 4], S, 4118548399);
                    V = u(V, Y, X, W, C[P + 5], Q, 1200080426);
                    W = u(W, V, Y, X, C[P + 6], N, 2821735955);
                    X = u(X, W, V, Y, C[P + 7], M, 4249261313);
                    Y = u(Y, X, W, V, C[P + 8], S, 1770035416);
                    V = u(V, Y, X, W, C[P + 9], Q, 2336552879);
                    W = u(W, V, Y, X, C[P + 10], N, 4294925233);
                    X = u(X, W, V, Y, C[P + 11], M, 2304563134);
                    Y = u(Y, X, W, V, C[P + 12], S, 1804603682);
                    V = u(V, Y, X, W, C[P + 13], Q, 4254626195);
                    W = u(W, V, Y, X, C[P + 14], N, 2792965006);
                    X = u(X, W, V, Y, C[P + 15], M, 1236535329);
                    Y = f(Y, X, W, V, C[P + 1], A, 4129170786);
                    V = f(V, Y, X, W, C[P + 6], z, 3225465664);
                    W = f(W, V, Y, X, C[P + 11], y, 643717713);
                    X = f(X, W, V, Y, C[P + 0], w, 3921069994);
                    Y = f(Y, X, W, V, C[P + 5], A, 3593408605);
                    V = f(V, Y, X, W, C[P + 10], z, 38016083);
                    W = f(W, V, Y, X, C[P + 15], y, 3634488961);
                    X = f(X, W, V, Y, C[P + 4], w, 3889429448);
                    Y = f(Y, X, W, V, C[P + 9], A, 568446438);
                    V = f(V, Y, X, W, C[P + 14], z, 3275163606);
                    W = f(W, V, Y, X, C[P + 3], y, 4107603335);
                    X = f(X, W, V, Y, C[P + 8], w, 1163531501);
                    Y = f(Y, X, W, V, C[P + 13], A, 2850285829);
                    V = f(V, Y, X, W, C[P + 2], z, 4243563512);
                    W = f(W, V, Y, X, C[P + 7], y, 1735328473);
                    X = f(X, W, V, Y, C[P + 12], w, 2368359562);
                    Y = D(Y, X, W, V, C[P + 5], o, 4294588738);
                    V = D(V, Y, X, W, C[P + 8], m, 2272392833);
                    W = D(W, V, Y, X, C[P + 11], l, 1839030562);
                    X = D(X, W, V, Y, C[P + 14], j, 4259657740);
                    Y = D(Y, X, W, V, C[P + 1], o, 2763975236);
                    V = D(V, Y, X, W, C[P + 4], m, 1272893353);
                    W = D(W, V, Y, X, C[P + 7], l, 4139469664);
                    X = D(X, W, V, Y, C[P + 10], j, 3200236656);
                    Y = D(Y, X, W, V, C[P + 13], o, 681279174);
                    V = D(V, Y, X, W, C[P + 0], m, 3936430074);
                    W = D(W, V, Y, X, C[P + 3], l, 3572445317);
                    X = D(X, W, V, Y, C[P + 6], j, 76029189);
                    Y = D(Y, X, W, V, C[P + 9], o, 3654602809);
                    V = D(V, Y, X, W, C[P + 12], m, 3873151461);
                    W = D(W, V, Y, X, C[P + 15], l, 530742520);
                    X = D(X, W, V, Y, C[P + 2], j, 3299628645);
                    Y = t(Y, X, W, V, C[P + 0], U, 4096336452);
                    V = t(V, Y, X, W, C[P + 7], T, 1126891415);
                    W = t(W, V, Y, X, C[P + 14], R, 2878612391);
                    X = t(X, W, V, Y, C[P + 5], O, 4237533241);
                    Y = t(Y, X, W, V, C[P + 12], U, 1700485571);
                    V = t(V, Y, X, W, C[P + 3], T, 2399980690);
                    W = t(W, V, Y, X, C[P + 10], R, 4293915773);
                    X = t(X, W, V, Y, C[P + 1], O, 2240044497);
                    Y = t(Y, X, W, V, C[P + 8], U, 1873313359);
                    V = t(V, Y, X, W, C[P + 15], T, 4264355552);
                    W = t(W, V, Y, X, C[P + 6], R, 2734768916);
                    X = t(X, W, V, Y, C[P + 13], O, 1309151649);
                    Y = t(Y, X, W, V, C[P + 4], U, 4149444226);
                    V = t(V, Y, X, W, C[P + 11], T, 3174756917);
                    W = t(W, V, Y, X, C[P + 2], R, 718787259);
                    X = t(X, W, V, Y, C[P + 9], O, 3951481745);
                    Y = K(Y, h);
                    X = K(X, E);
                    W = K(W, v);
                    V = K(V, g)
                }
                var i = B(Y) + B(X) + B(W) + B(V);
                return i.toLowerCase()
            };

            var size = size || 80;

            return 'https://www.gravatar.com/avatar/' + MD5(email) + '.jpg?d=identicon';
        }

        return Auth;
    }

  });
