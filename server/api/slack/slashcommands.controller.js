var request = require('request');
var url = require('url');
var Promise = require('promise');
var moment = require('moment');

var Firebase = require("firebase");
var FirebaseTokenGenerator = require("firebase-token-generator");
var FBRef = new Firebase("https://phaseddev.firebaseio.com/");
var tokenGenerator = new FirebaseTokenGenerator("0ezGAN4NOlR9NxVR5p2P1SQvSN4c4hUStlxdnohh");
var token = tokenGenerator.createToken({uid: "slack-server"});

// tokens to confirm our hit is coming from slack
var slackTokens = {
	update : 'N7etE1hdGQKZ2rHR4hWOPA2N',
	task : 'IvbJXqmXcMrH2c3vveEEVdoK',
	tell : 'QIFh8mSnSIrn905VbcWABRm3',
	link : 'nxCvd9z7Imj2FNdoscrOktM3',
	whatsup : 'q2Pa5ydGeR6s6attD2GQug35',
	sup : '8xTUgcyMNSTxX8M4MF3tkTUz',
	assign: 'q6xkAC9MORQxaMmgD7MImzxU',
	app: 'r7ITYpbnK2wVFzzZtI1QW0sp'
}

/**
**
**	ROUTES
**
*/

/**
*
*	links a user's slack and phased accounts
* (not really secure at all because you could give anyone else's email)
*
*/
exports.linkUser = function(req, res, next) {
	console.log('linking...', req.body);
	var slackReq = req.body;
	slackReq.text = slackReq.text.trim();
	// 0. verify token
	if (slackReq.token !== slackTokens.link && slackReq.token !== slackTokens.app) {
		res.end();
		return;
	}

	// 0. is this an email address?
	if (!(/.+\@.+\..+/.test(slackReq.text))) { // generous regex
		res.send(200, {
			text: 'That doesn\'t look like an email address...'
		});
		return;
	} else {
		res.send(200, {
			text: 'Working on it...'
		});
	}

	// auth
	FBRef.authWithCustomToken(token, function(error, authData) {
		if (error) {
			console.log("FireBase auth failed!", error);
			slackReplyError(slackReq.response_url);
			return;
		}

		// 1. get phased user for email address
		FBRef.child('profile').orderByChild('email').equalTo(slackReq.text).once('value', function(snap) {
			var user = snap.val();
			var userID = Object.keys(user)[0];

			if (!user) {
				slackReply(slackReq.response_url,
					'Whoops, couldn\'t find that email address',
					true,
					slackReq.text);
				return;
			}

			// now link accounts
			FBRef.child('integrations/slack/users/' + slackReq.user_id).set(userID, function(err) {
				if (err)
					slackReplyError(slackReq.response_url);
				else
					slackReply(slackReq.response_url,
						'Great, you\'re all set up. Try saying "/update Linking up my Slack and Phased accounts"',
						true);
			});
		}, function(e) {
			console.log('fb err', e);
			slackReplyError(slackReq.response_url);
		});
	});
}


/**
 *	Posts a status for a Slack Phased user
 *	/update
 *
 *	1. immediately reply to slack
 *		a) send them a post request
 *		b) shut down their post request with 200
 *	2. post to phased FB
 *		a) auth with FB
 *		b) get slack user's Phased ID
 *		c) update their status
 */
exports.update = function(req, res, next) {
	console.log('updating...', req.body);
	var slackReq = req.body;
	// 0. verify token
	if (slackReq.token !== slackTokens.update && slackReq.token !== slackTokens.app) {
		res.end();
		return;
	}

	// user didn't enter a status
	if (!('text' in slackReq) || slackReq.text.length === 0 || slackReq.text === ' ') {
		res.send(200, {
			text : 'Whoops, looks like you forgot to add a status! Just write it right after the slash command there.',
			ephemeral : true
		});
		return;
	} else {
		res.send(200, {text: "Great, I'll post that status!"});
	}

	// Post the new status update after authenticating and getting the Phased user ID
	// 2a)
	FBRef.authWithCustomToken(token, function(error, authData) {
		if (error) {
			console.log("FireBase auth failed!", error);
			slackReplyError(slackReq.response_url);
			return;
		}

		// 2b)
		getPhasedIDs(slackReq).then(function(args) {
			// 2c)
			updateStatus(args.userID, args.teamID, slackReq.text).then(function(){
				slackReply(slackReq.response_url,
					'Your Phased.io status has been updated.',
					true,
					slackReq.text);
			}, function(){
				slackReplyError(slackReq.response_url);
			});
		}, notLinkedYet);
	});
}

/**
*
*	/tell @user to [task]
*
*	1. parse text into @user and task
*
*/
exports.tell = function(req, res, next) {
	var slackReq = req.body;
	console.log('tell:', slackReq);

	// 0. verify token
	if (slackReq.token !== slackTokens.tell && slackReq.token !== slackTokens.app) {
		res.end();
		return;
	}

	// 1. parse text
	// 1a) check general format
	var regex = /^\@\w+\s(to)\s.+/; // @user to some task
	if (!regex.test(slackReq.text)) {
		res.send(200, {
			text : 'I don\'t understand what you\'re trying to say.',
			attachments : [{
				text : 'Use the format "/tell @billy to make a sandwich"'
			}]
		});
		return;
	}

	// 1b) split out user and task name
	var assigned_to_slack_name = slackReq.text.split(' to ')[0].split('@')[1];
	var taskName = slackReq.text.split(' to ')[1];

	console.log('assigning ' + taskName + ' to ' + assigned_to_slack_name);
	giveTaskToSlackUser(slackReq, res, taskName, assigned_to_slack_name);
}

/**
*
*	assign [task] to @user
*
*/
exports.assign = function(req, res, next) {
	var slackReq = req.body;
	console.log('assign:', slackReq);

	// 0. verify token
	if (slackReq.token !== slackTokens.assign && slackReq.token !== slackTokens.app) {
		res.end();
		return;
	}

	// 1. parse text
	// 1a) check general format
	var regex = /^.+\s(to)\s\@\w+/; // some task to @user
	if (!regex.test(slackReq.text)) {
		res.send(200, {
			text : 'I don\'t understand what you\'re trying to say.',
			attachments : [{
				text : 'Use the format "/assign make a sandwich to @billy"'
			}]
		});
		return;
	}

	// 1b) split out user and task name
	var assigned_to_slack_name = slackReq.text.split(' to ')[1].split('@')[1];
	var taskName = slackReq.text.split(' to ')[0];

	console.log('assigning ' + taskName + ' to ' + assigned_to_slack_name);
	giveTaskToSlackUser(slackReq, res, taskName, assigned_to_slack_name);
}

/**
*
*	create an unassigned [task]
*
*/
exports.task = function(req, res, next) {
	console.log('making unassigned task...', req.body);
	var slackReq = req.body;
	// 0. verify token
	if (slackReq.token !== slackTokens.task && slackReq.token !== slackTokens.app) {
		res.end();
		return;
	}

	// user didn't enter a status
	if (!('text' in slackReq) || slackReq.text.length === 0 || slackReq.text === ' ') {
		res.send(200, {
			text : 'Whoops, looks like you forgot to add a task name! Just write it right after the slash command there.',
			ephemeral : true
		});
		return;
	} else {
		res.send(200, {text: "I'll make that task."});
	}

	// Post the new status update after authenticating and getting the Phased user ID
	// 2a)
	FBRef.authWithCustomToken(token, function(error, authData) {
		if (error) {
			console.log("FireBase auth failed!", error);
			slackReplyError(slackReq.response_url);
			return;
		}

		// 2b)
		getPhasedIDs(slackReq).then(function(args) {
			// 2c)
			makeTask(args.userID, args.teamID, slackReq.text).then(function(){
				slackReply(slackReq.response_url,
					'Your new task has been added to Phased.',
					true,
					slackReq.text);
			}, function(){
				slackReplyError(slackReq.response_url);
			});
		}, notLinkedYet);
	});
}

/**
*
*	get status for @user
*
*/
exports.status = function(req, res, next) {
	console.log('getting status for user', req.body);
	var slackReq = req.body;
	slackReq.text = slackReq.text.trim();

	// 0. verify token
	if (slackReq.token !== slackTokens.whatsup && slackReq.token !== slackTokens.sup && slackReq.token !== slackTokens.app) {
		res.end();
		return;
	}

	// early check for username
	if (slackReq.text.indexOf('@') < 0) {
		res.send(200, {
			text: 'That doesn\'t look like a username',
			attachments : [{ text : 'Use the format "/whatsup @billy"' }]
		});
		return;
	}
	
	// clean the username
	// might end in ? ("/whatsup @johnny?")
	var user_slack_name = slackReq.text.split('?')[0];
	user_slack_name = user_slack_name.split('@')[1];

	console.log('getting current status for ' + user_slack_name);

	// 1c) try to find slack user ID
	getSlackUserIDFromUsername(user_slack_name).then(function(user_slack_ID) {
		// do quick reply here to be under 3sec
		res.send(200, {
			text: 'One sec...'
		});

		// update slackReq to use with this fn
		slackReq.user_id = user_slack_ID;

		FBRef.authWithCustomToken(token, function(error, authData) {
			if (error) {
				console.log("FireBase auth failed!", error);
				slackReplyError(slackReq.response_url);
				return;
			}
			// get Phased ID for user and team
			getPhasedIDs(slackReq).then(function(args) {
				console.log('got phased IDs', args);

				// get user's current status
				FBRef.child('team/' + args.teamID + '/members/' + args.userID).once('value', function(snap) {
					var member = snap.val();
					console.log('got member', member);

					if (!member) {
						slackReplyError(slackReq.response_url);
					} else {
						slackReply(slackReq.response_url,
							'@' + user_slack_name + '\'s current status: "' + member.currentStatus.name + '" (' + moment(member.currentStatus.time).fromNow() + ')',
							true,
							'Last active ' + moment(member.lastOnline).fromNow()
						);
					}
				});
			}, function(args) {
				console.log('err', args);
				if ('missingID' in args) {
					if (args.missingID == 'team')
						slackReply(slackReq.response_url, 'Looks like your team hasn\'t yet linked Slack and Phased accounts.');
					else if (args.missingID == 'user')
						slackReply(slackReq.response_url, 'Looks like that user hasn\'t linked their Slack and Phased accounts.');
				} else {
					slackReplyError(slackReq.response_url);
				}
			});
		});
	}, function() {
		res.send(200, {text: 'Couldn\'t find @' + user_slack_name });
	});
}


/**
**
**	HELPER FUNCTIONS
**
*/

/**
*
*	updates a status for a Phased user
*	REQUIRES AUTHORIZED FBRef
*
*	returns a promise. resolve is passed nothing, reject is possibly passed a FB error.
*
* 1. A) if teamID supplied, post status immediately
*	1. B) if not supplied, get it, then post status
*	2. posting status:
*		A) push to team
*		B) if successful, push to user's currentStatus
*		C) resolve promise
*/
var updateStatus = function(userID, teamID, statusText) {
	return new Promise(function(resolve, reject) {
		// fail if params are bad
		if (!userID || !statusText) {
			reject();
			return;
		}

		// 2. do the update given a teamID
		var newStatus = {
				name: statusText,
				time: new Date().getTime(),
				user: userID
			}

		// 2A) push status to team
		FBRef.child('team/' + teamID + '/statuses').push(newStatus, function(e) {
			if (e) {
				console.log(e);
				reject(e);
				return;
			}
			// 2B) set user's current status
			FBRef.child('team/' + teamID + '/members/' + userID + '/currentStatus').set(newStatus, function(e) {
				resolve(); // 2C) resolve our promise
			});
		});
	});
}

/**
*
*	makes a task
*	REQUIRES AUTHORIZED FBRef
*
*	assumes current team if no teamID supplied.
*	currently hardcoded to the default project/column/card.
*
*	returns a promise.
*
*	options.assigned_to should be a Phased user ID
*	options.deadline should be a timestamp
*
*/
var makeTask = function(userID, teamID, taskText, options) {
	return new Promise(function(resolve, reject) {
		// hardcorded defaults:
		var projectID = '0A',
			columnID = '0A',
			cardID = '0A';

		// prime task object
		task = {
			name : taskText,
			created_by : userID,
			assigned_by : userID,
			status : 2, // assigned
			time : new Date().getTime()
		}

		if (options) {
			if (options.assigned_to)
				task.assigned_to = options.assigned_to;
			else
				task.unassigned = true;

			if (options.deadline)
				task.deadline = options.deadline;
		}

		// add task to db
		var newTaskRef = FBRef.child('team/' + teamID + '/projects/' + projectID + '/columns/' + columnID + '/cards/' + cardID + '/tasks').push(task, function(e) {
			if (e)
				reject(e);
			else
				resolve();
		});
		
		// update task history
		newTaskRef.child('history').push({
			time : Firebase.ServerValue.TIMESTAMP,
			type : 0, // created
			snapshot : task
		}, function(e) {
			if (e)
				console.log(e); // don't reject here because it could be rejected twice
		});
	});
}

/**
*
*	helper for /tell and /assign
*	gives a task to a slack user
*	sends appropriate slack replies
*	
*	makes it so the exported functions are only doing
*	the different stuff (parsing)
*
*	assigned_to_slack_name should NOT incled the preceding @
*
*/
var giveTaskToSlackUser = function(slackReq, res, taskName, assigned_to_slack_name) {
	// 1c) try to find slack user ID
	getSlackUserIDFromUsername(assigned_to_slack_name).then(function(assigned_to_slack_ID) {
		// do quick reply here to be under 3sec
		res.send(200, {
			text : 'One sec...'
		});

		// Post the new status update after authenticating and getting the Phased user ID
		// 2a)
		FBRef.authWithCustomToken(token, function(error, authData) {
			if (error) {
				console.log("FireBase auth failed!", error);
				slackReplyError(slackReq.response_url);
				return;
			}
			// Get phased userID for assigned_to slack user
			getPhasedUserID(assigned_to_slack_ID).then(function(assigned_to_phased_ID) {
				// Get phased IDs for assigning slack user and team
				getPhasedIDs(slackReq).then(function(args) {
					// we now have all of our info and we can make our task.
					makeTask(args.userID, args.teamID, taskName, {assigned_to : assigned_to_phased_ID}).then(function() {
						slackReply(slackReq.response_url,
							'Your new task has been added to Phased and assigned to @' + assigned_to_slack_name,
							true,
							'Assigned "' + taskName + '"');
					}, function(){
						slackReplyError(slackReq.response_url);
					});
				}, notLinkedYet);
			}, function() {
				slackReply(slackReq.response_url,
					'@' + assigned_to_slack_name + ' hasn\'t liknked their Slack and Phased accounts yet.',
					true);
				return;
			});
		});
	}, function() {
		res.send(200, {text: 'Sorry, I couldn\'t find a match for the user @' + assigned_to_slack_name});
		return;
	});
}

/**
*
*	Parses an assignment string with an unknown format
*
*	returns object with taskName, assigned_to, and deadline properties
* (deadline is timestamp)
*
*	will always find a taskName, but assigned_to and deadline are optional
*
*/
var parseAssignmentString = function(str) {
	// 1. is there a user?
	// (str has @ and only contains /w before next space)
	// var segments = str.split(' '),
	// 	usernames = [],
	// 	deadlines = [];
	// for (var i in segments) {
	// 	if (segments[i].indexOf('@') == 0) {
	// 		var username = segments[i].split('@')[1];
	// 		if (/^/w+/.test(username)) {
	// 			usernames.push(username);
	// 		}
	// 	}
	// }

	// 2. is there a deadline?
}

/**
*
*	Gets a user's current team
*	REQUIRES AUTHORIZED FBRef.
*
*	returns a promise. resolve only if team ID returned; reject if not.
*
*/
var getUserTeam = function(userID) {
	return new Promise(function(resolve, reject){
		FBRef.child('profile/' + userID + '/curTeam').once('value', function(snap) {
			var teamID = snap.val();
			if (!teamID || teamID == '' || teamID == undefined)
				reject();
			else
				resolve(teamID);
		});
	});
}

/**
*
*	returns a promise that is passed the slack UID
*
*	takes the username without the leading @
*
*/
var getSlackUserIDFromUsername = function(username) {
	return new Promise(function(resolve, reject) {
		if (username === 'driedstr')
			resolve('U0FL8P1UL');
		else if (username == 'brian')
			resolve('U09M1EW03');
		else
			reject();
	});
}


/**
*
*	Gets a Phased user ID and teamID from their slack IDs.
*	REQUIRES AUTHORIZED FBRef.
*
*	returns a promise resolved with the Phased userID and teamID
*	the rejected promise is passed a firebase error OR an object
*	describing whether the user or team is missing their ID
*
*	It works well to set notLinkedYet as the resolve function,
*	but it's left open in case more fine-grained handling is needed.
*
*/
var getPhasedIDs = function(slackReq) {
	var slackUserID = slackReq.user_id,
		slackTeamID = slackReq.team_id;

	return new Promise(function(resolve, reject) {
		console.log('looking for user');
		FBRef.child('integrations/slack/users/' + slackUserID).once('value', function(snap) {
			var userID = snap.val();
			if (!userID) {
				reject({missingID : 'user', slackReq : slackReq});
			} else {
				console.log('found user, looking for team');
				FBRef.child('integrations/slack/teams/' + slackTeamID).once('value', function(snap) {
					var team = snap.val();
					if (!team) {
						reject({missingID : 'team', slackReq : slackReq});
					} else {
						resolve({userID : userID, teamID : team.teamID});
					}
				}, function(e) {
					reject({error : e, slackReq : slackReq});
				});
			}
		}, function(e) {
			reject({error : e, slackReq : slackReq});
		});
	});
}

/**
*
*	really simply get a phased user ID for a slack ID.
*
*/
var getPhasedUserID = function(slackUserID) {
	return new Promise(function(resolve, reject) {
		FBRef.child('integrations/slack/users/' + slackUserID).once('value', function(snap) {
			var userID = snap.val();
			userID ? resolve(userID) : reject();
		}, function(){
			reject();
		});
	});
}


/**
*
*	Simple set of responses for case where user or team hasn't been linked yet.
*
*	args should be the reject object from getPhasedIDs,
*	args.slackReq should be the original req.body
*
*/
var notLinkedYet = function(args) {
	console.log('notLinkedYet', args);
	if ('missingID' in args) {
		if (args.missingID == 'user') {
			slackReply(args.slackReq.response_url, 
				'Looks like you haven\'t linked up your Slack and Phased accounts yet. Link your account with the /link command.',
				true);
		} else if (args.missingID == 'team') {
			console.log('team missing');
			slackReply(args.slackReq.response_url, 'Looks like your team isn\'t hasn\'t linked their Slack and Phased accounts yet. Contact your team administrator to set this up.', true);
		} else
			slackReplyError(args.slackReq.response_url);
	} else {
		console.log('no missingID');
		slackReplyError(args.slackReq.response_url);
	}
}

/**
*
*	Wrapper to add ~*~ syntactical sugar ~*~
*	to reply to slack
*
*	set ephemeral to true to reply only to that user
*
*/
var slackReply = function(url, text, ephemeral, attachment) {
	console.log('slackReply');
	var body = {
			"response_type": ephemeral ? "ephemeral" : "in_channel",
			"text": text
		};
	console.log('doing reply', body);
	if (attachment)
		body.attachments = [{text: attachment}];
	console.log('sending req');
	request.post({
		url: url,
		body: body,
		json: true
	});
};

/**
*
*	Standard fail whale
*
*/
var slackReplyError = function(url) {
	console.log('slackReplyErr');
	slackReply(url, 
		'There\'s been an error on our end—sorry!',
		true);
}

/**
*	LEGACY: Customized slack update for UIT
*/
exports.uitSlack = function(req, res, next) {
	slackReply(req.body.response_url, 'Sorry, the Phased.io Slack integration is down for maintenance. We\'ll be back soon with even better features!');
	res.end();
	return;
}