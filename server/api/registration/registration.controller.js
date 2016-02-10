'use strict';

// Firebase business
// copied from pushserver
var Firebase = require("firebase");
var FirebaseTokenGenerator = require("firebase-token-generator");

var FBRef = new Firebase("https://phased-dev2.firebaseio.com/");
var tokenGenerator = new FirebaseTokenGenerator("igwdoQvGJzn0LXBPKWmn5RllwVZSFqIOo3JLeBm0");
var token = tokenGenerator.createToken({uid: "registration-server",isReg: true });
var stripe = require('stripe')('sk_test_XCwuQhHhSTCGrbXl12ubBE8Y');

exports.index = function(req, res) {
	res.json([]);
};

// used in registerTeam when creating a team
// it's important that the category etc keys be strings
var defaultTeam = {
    statuses : {},
    projects : {
      '0A' : {
        name : 'Default project',
        description : 'This is the default project. It is hidden when it is the only project.',
        isDefault : true, // isDefault to avoid default keyword
        created : Firebase.ServerValue.TIMESTAMP,
        columns : {
          '0A' : {
            name : 'Default column',
            isDefault : true,
            cards: {
              '0A' : {
                name : 'Default card',
                description : 'This is the default card. It is hidden when it is the only card.',
                isDefault : true,
                tasks : {}, // filled eventually
                history : {
                  '0A' : {
                    time : Firebase.ServerValue.TIMESTAMP,
                    type : 0, // PhasedProvider.card.HISTORY_ID.CREATED
                    snapshot : {
                      name : 'Default card',
                      description : 'This is the default card. It is hidden when it is the only card.',
                      isDefault : true
                    }
                  }
                }
              }
            },
            history : {
              '0A' : {
                time : Firebase.ServerValue.TIMESTAMP,
                type : 0, // PhasedProvider.column.HISTORY_ID.CREATED
                snapshot : {
                  name : 'Default column',
                  isDefault : true
                }
              }
            }
          }
        },
        history : {
          '0A' : {
            time : Firebase.ServerValue.TIMESTAMP,
            type : 0, // PhasedProvider.project.HISTORY_ID.CREATED
            snapshot : {
              name : 'Default project',
              description : 'This is the default project. It is hidden when it is the only project.',
              isDefault : true
            }
          }
        }
      }
    },
    members : {},
    billing : {
      email : '',
      name : '',
      stripeid : '',
      plan : 'basic'
    },
    category : {
      '0A' : {
        color: '#FFCC00',
        name : 'Communication'
      },
      '1B' : {
        color: '#5AC8FB',
        name : 'Planning'
      }
    }
  }

/**
*
* 	Invites a user to a team
*
*		1. if user in /profile, simply add to team
*		2. if user in /profile-in-waiting, add team to profile-in-waiting and wait for user to join
*		3. if user in neither, create profile-in-waiting
*
*/

exports.invite = function(req, res) {
	console.log(req.body);
	var invitedEmail = req.body.invitedEmail,
		teamID = req.body.team,
		inviterEmail = req.body.inviterEmail,
		inviterName = req.body.inviterName;

	// check data
	if (!(typeof invitedEmail == 'string' && invitedEmail.length > 0 )
		|| !(typeof teamID == 'string' && teamID.length > 0)
		|| !(typeof inviterEmail == 'string' && inviterEmail.length > 0)
		|| !(typeof inviterName == 'string' && inviterName.length > 0)
		) {
		res.send({
			err: true,
			message: 'bad data'
		});
		return;
	}


	// 0. Authenticate request
	FBRef.authWithCustomToken(token, function(error, authData) {
		if (error) {
			res.send(error);
			return;
		}

    invitedEmail = invitedEmail.toLowerCase(); // Change text to lowercase regardless of user input.

    FBRef.child("profile").orderByChild("email").equalTo(invitedEmail).once('value',function(snap){
      var users = snap.val();

      if (users) {
        var userID = Object.keys(users)[0];
        // 1. add to team
        FBRef.child('profile/' + userID + '/teams').push(teamID); // add to user's teams
        FBRef.child('team/' + teamID + '/members/' + userID).update({role : 0}); // add to this team

        res.send({
        	success : true,
        	added : true,
        	userID : userID
        });
      } else {
        // 2. check if in profile-in-waiting
        FBRef.child("profile-in-waiting").orderByChild("email").equalTo(invitedEmail).once('value',function(snap){
          var users = snap.val();

          if (users) {
            var PIWID = Object.keys(users)[0];
            // already in PIW, add our team and wait for user
            FBRef.child('profile-in-waiting/' + PIWID + '/teams').push(teamID);
          } else {
            // newly add to PIW
            var PIWData = {
              'teams' : { 0 : teamID},
              'email' : invitedEmail,
              'inviteEmail': inviterEmail,
              'inviteName': inviterName
            };
            FBRef.child('profile-in-waiting').push(PIWData);
            FBRef.child('profile-in-waiting2').push(PIWData); // for Zapier

		        res.send({
		        	success : true,
		        	invited : true
		        });
          }
        });
      }
    }, function(err){ console.log(err) });
	});
}

/**
*
*	A new user is signing up for the service
*
*/

exports.register = function(req, res) {
	var user = req.body.user; // user who is authorized to do the changing
	user = JSON.parse(user);
	console.log('user', user);

	// 0. authenticate request
	FBRef.authWithCustomToken(token, function(error, authData) {
		if (error) {
			res.send(error);
			return;
		}

		// 1. create Firebase user
		FBRef.createUser({email: user.email, password: user.password}, function(err, data) {
	    if (err) {
	    	console.dir(err);
	    	res.send(err);
	      switch (err.code) {
					case 'EMAIL_TAKEN':
						// toaster.pop('error', 'Error', user.email + ' is already registered.');
						break;
						default :
						// toaster.pop('error', 'Error', 'Could not register user.');
					break;
	      }
	    } else {
	      console.log('no errors, creating profile');
	      var uid = data.uid; // stash UID
				/**
				*   Create a new profile for a user coming to the site
				*
				*   1. check if profile-in-waiting has been set up by some team admin
				*       1B - if so, add to those teams
				*   2. create profile
				*
				*/
	      // 1.
			  FBRef.child('profile-in-waiting').orderByChild('email').equalTo(user.email).once('value', function(snap){
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
						  FBRef.child('team/' + PIW.teams[i] + '/members/' + uid).update({
						    role: 0 // member
						  });
						}
		      }

		      // 2. create profile and remove PIW
		      FBRef.child('profile/' + uid).set(profile, function(err){
		      	if (!err) {
		          if (PIWID) {
		              FBRef.child('profile-in-waiting/' + PIWID).remove();
		          }
		          console.log('success, profile created');
		          res.send({
		          	success: true,
		          	message : 'User and profile created'
		          });
		        } else {
		        	res.send(err);
		        	FBRef.removeUser(user, function(err){
		        		if (err) {
		        			console.log('error removing user');
		        			console.log(err);
		        		} else
		        			console.log('user removed');
		        	})
		        }
		      });
			  }, function(err){
		      console.log(err);
		      res.send({
		      	success: false,
		      	err: err
		      });
			  });
	    }
	  });
	});
}


/**
*
*	Regsiters a new team
*	1. check if teamname is taken
* 2. if not:
*  - create the team in /team
*  - add to current user's profile
*  - make it their current team
*  - run success callback if it exists
*/
exports.registerTeam = function(req, res) {
	var teamName = req.body.teamName,
		email = req.body.email,
		userID = req.body.userID;

	// 0. Authenticate request
	FBRef.authWithCustomToken(token, function(error, authData) {
		if (error) {
			res.send(error);
			return;
		}
		console.log(authData);

		// get team with specified name
    FBRef.child('team').orderByChild('name').equalTo(teamName).once('value', function(snap) {
      var existingTeams = snap.val(),
        newTeamRef = '',
        newTeamKey = '',
        newRole = 2; // owner

      // if it doesn't exist, make it
      if (!existingTeams) {
        defaultTeam.name = teamName;
        newTeamRef = FBRef.child('team').push(defaultTeam);
        newTeamKey = newTeamRef.key();
      } else {
      	// bail since the team exists
      	res.send({
      		err : 'TEAM_EXISTS'
      	});
      	return;
      }
			// Add team to sub and start trial

			FBRef.child('profile/' + userID).once('value',function(snap){
				snap = snap.val();
				if(snap){
					stripe.customers.create({
						description: 'Pays for team: ' + newTeamKey,
						email : snap.email,
						plan: "basic",
					}, function(err, customer) {
						// asynchronously called
						if (err) {
								 // bad things
										console.log(err);
										res.send({err:err});
						} else {
								// successful charge
								 console.log(customer.id);
								 console.log(snap.email);
								 console.log(userID);
								 FBRef.authWithCustomToken(token, function(error, authData) {
									 FBRef.child('team').child(newTeamKey).child('billing').set({
										 "name": userID,
										 "email": snap.email,
										 "plan": "basic",
										 "stripeid": customer.id
									 });
								 })

						 }
					});
				}
			});




      // add to new team
      newTeamRef.child('members/' + userID).update({
        role : newRole
      });

      // add to my list of teams if not already in it
      FBRef.child('profile/' + userID + '/teams').orderByValue().equalTo(newTeamKey).once('value', function(snap){
        if (!snap.val()) {
          FBRef.child('profile/' + userID + '/teams').push(newTeamKey, function(err){
          	if (!err)
		        	res.send({
		        		success:true,
		        		teamID : newTeamKey
		        	});
          });
        } else {
        	res.send({
        		success:true,
        		teamID : newTeamKey
        	});
        }
      });
    });
	});
}


// get a user's gravatar from their email address
var get_gravatar = function(email, size) {
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
