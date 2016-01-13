'use strict';

// Firebase business
// copied from pushserver
var Firebase = require("firebase");
var FirebaseTokenGenerator = require("firebase-token-generator");

var FBRef = new Firebase("https://phaseddev.firebaseio.com/");
var tokenGenerator = new FirebaseTokenGenerator("0ezGAN4NOlR9NxVR5p2P1SQvSN4c4hUStlxdnohh");
var token = tokenGenerator.createToken({uid: "modServer", some: "arbitrary", data: "here"});
FBRef.authWithCustomToken(token, function(error, authData) {});

exports.index = function(req, res) {
	res.json([]);
};

// gives user's current role on current team
exports.getRole = function(req, res) {
	var user = req.body.user;
	var team = req.body.team;
 	
 	// actually go and get the role
 	var getRoleForTeam = function(user, team) {
		// get current role
		FBRef.child('team/' + team + '/roles/' + user).once('value', function(data){
			var role = data.val();
			// if no role, default to 'member'
			if (!role) {
				res.send({
					success : true,
					role : 'member'
				});
			} else {
				// send role
				res.send({
					success : true,
					role : role
				});
			}
		});
 	}

 	if (team) {
 		getRoleForTeam(user, team);
 		return;
 	} else {
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

			getRoleForTeam(user, team);
		});
	}
}

// set role for a user
exports.setRole = function(req, res) {
	var assignee = req.body.assignee; // user whose role is changing
	var user = req.body.user; // user who is authorized to do the changing
	var newRole = req.body.role ? req.body.role.toLowerCase() : false;

	// simple validation for new role
	var validRoles = ['member', 'admin', 'owner'];
	if (!newRole || (validRoles.indexOf(newRole) < 0) ) {
		res.send({
			err : 'invalid role',
			body : req.body,
			role : newRole,
			index: validRoles.indexOf(newRole),
			validRoles : validRoles
		});
		return;
	}

	// simple validation for user and assignee
	if (!assignee) {
		res.send({
			err : 'no assignee'
		});
		return;
	}
	if (!user) {
		res.send({
			err : 'no user'
		});
		return;
	}

	// get current team
	FBRef.child('profile/' + user + '/curTeam').once('value', function(data) {
		var team = data.val();
		// if no team, respond with error
		if (!team) {
			res.send({
				err : 'no team'
			});
			return;
		}

		// get current role
		FBRef.child('team/' + team + '/roles/' + user).once('value', function(data) {
			var role = data.val();
			var override = true; // override permissions

			// check role permissions
			if ((!role || (role != 'owner' && role != 'admin')) && !override) {
				res.send({
					err : 'insufficient permissions'
				});
				return;
			} else {
				// set role
				FBRef.child('team/' + team + '/roles/' + assignee).set(newRole, function() {
					res.send({
						success : true
					});
				});
			}
		})
	});

}