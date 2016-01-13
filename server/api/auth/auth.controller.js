'use strict';

// Firebase business
// copied from pushserver
var Firebase = require("firebase");
var FirebaseTokenGenerator = require("firebase-token-generator");

var FBRef = new Firebase("https://phaseddev.firebaseio.com/");
var tokenGenerator = new FirebaseTokenGenerator("0ezGAN4NOlR9NxVR5p2P1SQvSN4c4hUStlxdnohh");
var token = tokenGenerator.createToken({uid: "modServer", some: "arbitrary", data: "here"});
FBRef.authWithCustomToken(token, function(error, authData) {
  if (error) {
    console.log("Login Failed!", error);
  } else {
    console.log("Login Succeeded!", authData);
  }
});

exports.index = function(req, res) {
	res.json([]);
};

// gives user's current role on current team
exports.roles = function(req, res) {
	var user = req.body.user;
	var team = req.body.team;

	// get current team
	FBRef.child('profile/' + user + '/curTeam').once('value', function(data){
		var team = data.val();
		// if no team, respond with error
		if (!team) {
			res.send({
				err : 'no team'
			});
			return;
		}

		// get current role
		FBRef.child('teams/' + team + '/roles/' + user).once('value', function(data){
			var role = data.val();
			// if no role, default to 'member'
			if (!role) {
				res.send({
					success : true,
					role : 'admin'
				});
			} else {
				// send role
				res.send({
					success : true,
					role : role
				});
			}
		})
	});
}