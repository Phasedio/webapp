'use strict';
var config = require('../../config/environment');
var FBRef = require('../../components/phasedFBRef').getRef();
var moment = require('moment');
var mandrill = require('mandrill-api/mandrill');
var mandrill_client = new mandrill.Mandrill('B0N7XKd4RDy6Q7nWP2eFAA');


//email templates
function sendNewTaskNotif(assignedBy, assignedTo, teamID, taskName){
	var issueUser = assignedBy,
		inviterUser = assignedTo;

		FBRef.child('profile').child(issueUser).once('value',function(snap){
			issueUser = snap.val();
			if(issueUser) {
				FBRef.child('profile').child(inviterUser).once('value',function(snap){
					if(snap){
						inviterUser = snap.val();

						// Now send email.
						var template_name = "new-task-assigned-to-you";
						var template_content = [{
							"name": "issuerName",
							"content": inviterUser.name
						},
						{
							"name": "taskName",
							"content": taskName
						}];

						var message = {

							"subject": "New task assigned to you",
							"to": [{
										 "email": issueUser.email,
										 "type": "to"
								 }],
							"from_name": inviterUser.name + " via Phased",
						};

						mandrill_client.messages.sendTemplate({"template_name": template_name, "template_content": template_content, "message": message}, function(result) {
					    console.log(result);

						}, function(e) {
						    // Mandrill returns the error as an object with name and message keys
						    console.log('A mandrill error occurred: ' + e.name + ' - ' + e.message);
						    // A mandrill error occurred: Unknown_Subaccount - No subaccount exists with the id 'customer-123'
						});
				}

		});
	}
});
}




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
		meta = JSON.parse(req.body.meta),
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

	res.send({
		success : true,
		message : 'sending notification'
	});

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

		if (cleanNotif.type == 1 && meta.assignedBy) {
			// send a email for task assigned to you.
			sendNewTaskNotif(meta.assignedBy, meta.assignedTo, team, meta.taskName);
		}
	}, function failure(err){
		console.log(err);
	});


	//decide if i should send an email.


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

	// send a nice response
	res.send({
		success : true,
		message : 'cleaning notifications...'
	});

	// 1. get timestamp (currently one month ago)
	var aDate = moment().subtract(1, 'month');
	var timestamp = aDate.unix()

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
			FBRef.child(notifAddr + '/' + key).remove();
			i++;
		}
		return;
	});
}

/**
*
*	Issues a like message to user emails
*
*
*/
exports.like = function(req, res) {
	var user = req.body.user,
		likedUser = req.body.likedUser
	var template_name = "liketemplate";
	var template_content = [{
		"name": "likerName",
		"content": user.name
	}];

	var message = {

		"subject": likedUser.name + " has liked your status",
		"to": [{
					 "email": user.email,
					 "type": "to"
			 }],
		"from_name": likedUser.name + " via Phased",
	};

	mandrill_client.messages.sendTemplate({"template_name": template_name, "template_content": template_content, "message": message}, function(result) {
		console.log(result);

	}, function(e) {
			// Mandrill returns the error as an object with name and message keys
			console.log('A mandrill error occurred: ' + e.name + ' - ' + e.message);
			// A mandrill error occurred: Unknown_Subaccount - No subaccount exists with the id 'customer-123'
	});

	res.send({
		success : true,
		message : 'like sent'
	});

};
