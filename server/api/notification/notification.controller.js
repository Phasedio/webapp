'use strict';

// Firebase business
// copied from pushserver
var Firebase = require("firebase");
var FirebaseTokenGenerator = require("firebase-token-generator");

var FBRef = new Firebase("https://phased-dev2.firebaseio.com/");
var tokenGenerator = new FirebaseTokenGenerator("A50wFi5OxaLYNzb4jnEyFMQWmE8mjRyWJCKW723g");
var token = tokenGenerator.createToken({ uid: "notif-server"});

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
	// do after authenticated
	FBRef.authWithCustomToken(token, function(error, authData) {
		// fail if error
		if (error) {
			console.log(error);
			res.send({
				err : error
			});
			return;
		}

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
				err : 'invalid team ID'
			});
			return;
		}

		// check own user ID
		if (typeof user != 'string' || user.length <= 0) {
			console.log('error - invalid user');
			res.send({
				err : 'invalid user ID'
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
				'type' : 'number',
				'required' : true
			},
			// could be implemented in the future
			'url' : {
				'type' : 'string'
			},
			'img' : {
				'type' : 'string'
			},
			'cat' : {
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
		FBRef.child('team/' + team + '/members').once('value', function success(data) {
			var users = data.val();

			for (var id in users) {
				console.log('issuing to user ' + id);
				// 3. push to user's notification list
				if (id != user || cleanNotif.type == 8) // except current user
					FBRef.child('notif/' + team + '/' + id).push(cleanNotif);
			}

			res.send({
				success : true
			});
		}, function failure(err){
			res.send({
				err : 'FB err: ' + err
			});
		});
	}); // end authWithCustomToken callback
}

/**
*
*	cleans a user's notifications
*
*	0. check user and team inputs
* 1. get timestamp (currently one month ago)
* 2. get all notifs before timestamp
* 3. if notif is read, .remove() it
*
*/
exports.cleanNotifications = function(req, res) {
	// do after authenticated
	FBRef.authWithCustomToken(token, function(error, authData) {
		// fail if error
		if (error) {
			console.log(error);
			res.send({
				err : error
			});
			return;
		}

		var user = req.body.user,
			team = req.body.team;

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

		// 1. get timestamp (currently one month ago)
		var aDate = new Date();
		var timestamp = aDate.setMonth(aDate.getMonth() - 1);

		// 2. get notifications older than one month
		var notifAddr = 'notif/' + team + '/' + user;
		FBRef.child(notifAddr)
			.orderByChild('time')
			.endAt(timestamp)
			.once('value', function(data){
				// 3. remove read notifs
				var notifs = data.val();
				var i = 0;
				for (var key in notifs) {
					if (notifs[key].read) {
						FBRef.child(notifAddr + '/' + key).remove();
						i++;
					}
				}

				// send a nice response
				res.send({
					success : true,
					message : 'cleaned ' + i + ' read notifs since ' + aDate
				});
				return;
			});
	});// end authWithCustomToken callback
}