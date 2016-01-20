'use strict';

// Firebase business
// copied from pushserver
var Firebase = require("firebase");
var FirebaseTokenGenerator = require("firebase-token-generator");

var FBRef = new Firebase("https://phaseddev.firebaseio.com/");
var tokenGenerator = new FirebaseTokenGenerator("0ezGAN4NOlR9NxVR5p2P1SQvSN4c4hUStlxdnohh");
var token = tokenGenerator.createToken({uid: "modServer" , origin : "notification.controller.js" });
FBRef.authWithCustomToken(token, function(error, authData) {});

exports.index = function(req, res) {
	res.json([]);
};


/**
*
*	issues a notification to all members of a team except issuer (user)
*	
*	1. clean notification
*	2. get list of members
*	3. push to each /notif/$team/$member list
*
*/
exports.issueNotification = function(req, res) {
	var user = req.body.user,
		team = req.body.team,
		notification = JSON.parse(req.body.notification);

	console.log('issuing notification');
	console.dir(notification);

	// 0. check inputs
	// check team name
	if (typeof team != 'string' || team.length <= 0) {
		console.log('error - invalid team');
		res.send({
			err : 'invalid team name'
		});
		return;
	}

	// check own user ID
	if (typeof user != 'string' || user.length <= 0) {
		console.log('error - invalid user');
		res.send({
			err : 'invalid user id'
		});
		return;
	}

	// 1. clean notification: check if the property is of the
	// expected type. If a prop is required, fail with response message
	var props = {
		// property : { type, required }
		'title' : {
			'type' : 'object',
			'required' : true
		},
		'body' : {
			'type' : 'object',
			'required' : true
		},
		'type' : {
			'type' : 'string',
			'required' : true
		},
		// could be implemented in the future
		'url' : {
			'type' : 'string'
		},
		'img' : {
			'type' : 'string'
		}
	}

	var cleanNotif = {
		time : new Date().getTime(), // always in UTC (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/getTime)
		read : false
	}; // sent to server

	// check each property
	for (var prop in props) {
		if (typeof notification[prop] == props[prop].type) { // prop is good
			cleanNotif[prop] = notification[prop];
		} else if (props[prop].required) { // prop is bad and required
			console.log('error - invalid notification obj (missing ' + prop + ")");
			console.dir(notification);
			res.send({
				err : 'required notification property "' + prop + '" invalid or missing'
			})
			return;
		}
	}

	// 2. get team members

	// get users from FB
	FBRef.child('team/' + team + '/task').once('value', function success(data) {
		var users = data.val();

		for (var id in users) {
			console.log('issuing to user ' + id);
			// 3. push to user's notification list
			// if (id != user) // except current user
				FBRef.child('notif/' + team + '/' + id).push(cleanNotif);
		}
	}, function failure(err){
		res.send({
			err : 'FB err: ' + err
		});
	})

}