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

/** 
*
* gives user's current role on a team
*
*	1A. if team is set, get member's role on that team
* 1B. if team is not set, get members role on their current team
* 2. for the selected team, retrieve user's value from roles/
*
*/

exports.getRole = function(req, res) {
	var user = req.body.user;
	var team = req.body.team;
 	
 	// 2. actually go and get the role
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

 	// 1A.
 	if (team) {
 		getRoleForTeam(user, team);
 		return;
 	} else {
 		// 1B.
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

/**
*
* set role for an assignee on a user's current team
* if the user has adequate permissions
*
*	1. validate incoming data (role value, presence of assignee and user)
* 2. get user's current team
* 3A. get user's current role
* 3B. check user's current role
* 4. set assignee's role
*
*/

exports.setRole = function(req, res) {
	var assignee = req.body.assignee; // user whose role is changing
	var user = req.body.user; // user who is authorized to do the changing
	var newRole = req.body.role ? req.body.role.toLowerCase() : false;

	// 1. simple validation for new role
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

	// 2. get current team
	FBRef.child('profile/' + user + '/curTeam').once('value', function(data) {
		var team = data.val();
		// if no team, respond with error
		if (!team) {
			res.send({
				err : 'no team'
			});
			return;
		}

		// 3A. get user's current role
		FBRef.child('team/' + team + '/roles/' + user).once('value', function(data) {
			var role = data.val();
			var override = true; // override permissions

			// 3B. check user's role permissions
			if ((!role || (role != 'owner' && role != 'admin')) && !override) {
				res.send({
					err : 'insufficient permissions'
				});
				return;
			} else {
				// 4. set assignee's role
				FBRef.child('team/' + team + '/roles/' + assignee).set(newRole, function() {
					res.send({
						success : true
					});
				});
			}
		})
	});

}