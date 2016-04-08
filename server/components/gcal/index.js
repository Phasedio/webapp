/**
		GCal task scheduling

		Scheduling works in cycles: a masterJob is run once every period (daily in prod, minutely in dev)
		It gathers information about registered calendars, then gathers their current event information
		and schedules posts for those events. Additionally, it monitors the DB for changes in calendar
		registration and modifies the scheduled events as necessary (adding or removing).

		*Calendar registration unique to each user on a team.
		eg, cal A registered to team 1 for user N is a different registration than cal A registered to team 2
		for user N or for cal A registered to team 1 for user Y. This is tracked by the firebase key, which
		is how the respective event post jobs are grouped in eventJobList

		Timeline:
		MasterJob {
			- authenticate
			- (clear event handlers and list of registered calendars from last cycle)
			- register new event handlers (user key added or removed in calendar integrations)
			info for a user integration comes in (onUserAdded) {
				- get google creds from DB
				get events from google for each calendar for each team in list {
					for each calendar registration in our DB (onCalAdded)
						- make sure it has an entry in eventJobList (possibly just {})
						- get all events from Google API
							then either schedule the post, post immediately, or do nothing
				}
			}
		}

		scheduling a post (in onCalAdded):
			- use the node-schedule module to create a job
			- attach the job to the event's calendar-registration key in eventJobList
				in case it needs to be canceled later
		job executes (doEventJob):
			- post for the user for that team
			- remove job from eventJobList (since it's done)
		calendar-registration removed (onCalRemoved):
			- cancel all listed jobs in eventJobList
			- delete eventJobList calendar key
		user key removed from integrations (onUserRemoved)
			- cancel all FB event handlers
			- cancel all event jobs for all calendars (using onCalRemoved for each)

		TODO webhooks:
			- webhook hit with reference token in header whenever a cal event in the
				cycle is modified. when this happens, refresh the cal data.

 */

'use strict';

// Modules
// ====
var config = require('../../config/environment');
var Firebase = require("firebase");
var FirebaseTokenGenerator = require("firebase-token-generator");
var schedule = require("node-schedule");
var Promise = require("promise");
var google = require('googleapis');
var querystring = require('querystring');
var uuid = require('node-uuid');
var _ = require('lodash');

// Firebase business
// ====
var FBRef = require('../../components/phasedFBRef').getRef();
var Phased = require('../../components/phased');

// Google API business
// ====
var OAuth2 = google.auth.OAuth2;
var GCal = google.calendar('v3');
var CLIENT_ID = config.google.CLIENT_ID,
		CLIENT_SECRET = config.google.CLIENT_SECRET,
		REDIRECT_URL = config.google.REDIRECT_URL;

// internal business
// ====
var masterJob, // set in init

 	// eventJobList is a list of all scheduled jobs, indexed by calendar's FireBase key, which is
 	// guaranteed to be unique (important, since the same cal could be registered
 	// for multiple people or multiple teams)
	//
 	// also our reference of which calendars do not need to be re-registered. Since we re-gather
 	// all calendar information each masterJob cycle, this is reset to {} every cycle.
 	// eventJobList = {
	//		calFBKey : [job, job, ...], ...
 	// }
	eventJobList = {},

	// similarly, usersList is a list of userIDs with FB event handlers registered
	// these will be deregistered each cycle and the list emptied and refilled as appropriate
	usersList = {}, // usersList[userID] = true

	// webhookChannelTokens is a list of webhook tokens indexed by their channel IDs.
	// this is validated against whenever the webhook is hit to make sure the data
	// we're expecting is there.
	webhookChannelTokens = {},

	// time at which statuses should be posted for all day events. IN GMT!!! 24h, HH:MM:SS
	// maybe a better solution to this. (ie, get timezone from calendar)
	DAY_START_TIME = '12:00:00'; // 8AM EST

module.exports = {

	/**
	*
	*	BEGIN SCHEDULING CYCLES
	*
	*/
	init : function() {
		console.log('starting GCal task scheduling');

		// using a rule means the job will recur
		// using a date object will only run the job once
		var rule = {
			hour : 2, // start scheduling the day's events at 2AM
			minute : 0 // leaving this null would run the job every minute!
		};

		// run the master job every 30 minutes to test
		if (config.env === 'development')
			rule = '*/30 * * * *';

		masterJob = schedule.scheduleJob(rule, doMasterJob);
		masterJob.job(); // invoke job immediately as well as when scheduled

		// every five mins, log the jobs that are currently scheduled
		// schedule.scheduleJob('*/5 * * * *', function(){
		// 	console.log('scheduled jobs:', eventJobList);
		// });
	},

	/**
	*
	*	EVENTS WEBHOOK ENDPOINT
	*	hit by google server
	*
	* google doesn't give any new information about the event
	*	so we have to make another request to the server to update
	*	the entire fracking calendar.
	*
	*/
	eventPush : function(req, res) {
		var resourceState = req.headers['x-goog-resource-state'];
		// if state is sync, do nothing (just the webhook confirm hit)
		// otherwise, state sould be 'exists'; refresh data for calendar

		if (resourceState === 'exists') {
			var token = querystring.parse(req.headers['x-goog-channel-token']);
			var channelID = req.headers['x-goog-channel-id'];

			// check if token data is compromised; if so, send 404
			if (! _.isEqual(webhookChannelTokens[channelID], token) ) {
				res.status(404).end();
				// console.info('google cal events webhook hit with bad token, 404 sent.', channelID);
				return;
			} else {
				// send 200 right away and get on with our business
				res.status(200).end();
			}

			onCalRemoved(token.calFBKey); // synchronous
			setGOA2Creds(token.userID).then(function success(_oa2Client) {
				// passing true as the last parameter ensures multiple webhooks aren't registered in the same cycle
				onCalAdded(_oa2Client, token.calID, token.calFBKey, token.userID, token.teamID, true);
			});

		} else if (resourceState === 'sync') {
			res.status(200).end();
			// console.log('webhook confirmed');
		} else {
			res.status(404).end();
			console.log('unexpected webhook hit');
		}
	}
};

/*
	- 1. Authenticate with firebase
	- 2. Remove last round's references:
		- FireBase .on()
		- eventJobList -- there should be none outstanding and we need to re-gather all calendars anyway
		- webhookChannelTokens -- we will register new ones and these will have expired anyway
	- 3. FB.on to monitor calendars:
		- onUserAdd/Removed registers handlers for cals added/removed (also takes care of nesting by teams)
*/
var doMasterJob = function() {
	console.log('executing masterJob; next iteration at ', masterJob.pendingInvocations()[0].fireDate.toString());

	// 2.
	FBRef.child('integrations/google/calendars').off(); // kills all event handlers
	for (var userID in usersList) {
		FBRef.child('integrations/google/calendars/' + userID).off(); // remove all event handlers
	}
	usersList = {}; // clear user list
	eventJobList = {}; // clear job list;
	webhookChannelTokens = {}; // clear webhook tokens

	// 3. get this party started
	FBRef.child('integrations/google/calendars').on('child_added', onUserAdd, function(err){
		console.log('err', err);
	});
	FBRef.child('integrations/google/calendars').on('child_removed', onUserRemoved, function(err){
		console.log('err', err);
	});
}

/**
*
* registers all events for all cals for all teams on this user
*
*	1. immediately register all present calendars using child_added
*			to also listen for new teams (doesn't catch new cals on known teams)
*	2. watch for new cals on known teams using child_changed
*
*/
var onUserAdd = function(snap) {
	var userID = snap.key(),
		calsByTeam = snap.val();

	usersList[userID] = true; // setting this key lets us know we have FB event handlers to de-register later

	// 1. set up initial scheduling
	FBRef.child('integrations/google/calendars/' + userID).on('child_added', function onTeamAdded(snap) {
		var teamID = snap.key(),
			cals = snap.val();

		// register new cals
		setGOA2Creds(userID).then(function success(_oa2Client) {
			registerCalsForTeam(_oa2Client, cals, userID, teamID);
		});
	});

	// 2. future-proofing: whenever the user's calendar registration changes
	FBRef.child('integrations/google/calendars/' + userID).on('child_changed', function onTeamChanged(snap) {
		var teamID = snap.key(),
			cals = snap.val();

		// register new cals
		setGOA2Creds(userID).then(function success(_oa2Client) {
			registerCalsForTeam(_oa2Client, cals, userID, teamID);
		});
	}, function(err){
		console.log('child_changed err', err);
	});
}

/**
*
* deregister all events for all cals for all teams on this user
*
*/
var onUserRemoved = function(snap) {
	var userID = snap.key(),
		calsByTeam = snap.val();

	// stop listening for this user's data
	FBRef.child('integrations/google/calendars/' + userID).off();

	// deregister all calendars
	for (var teamID in calsByTeam)
		for (var calFBKey in calsByTeam[teamID])
			onCalRemoved(calFBKey);
}

/**
*
*	register all new calendars for the team
*
*	- checks if each calendar is registered
*	- if it's not,
*		1. schedules posts for all of its events
*		2. then watches for deregistration
*
*	NB: expects cals param to be indexed by Firebase key!
*
*/
var registerCalsForTeam = function(_oa2Client, cals, userID, teamID) {
	// console.log('registering ' + Object.keys(cals).length + ' cals for ' + userID);
	for (var calFBKey in cals) {
		if (!(calFBKey in eventJobList)) {
			// 1. schedule jobs for calendar events
			onCalAdded(_oa2Client, cals[calFBKey].id, calFBKey, userID, teamID);
		}
	}

	// 2. watch team for calendar deregistration
	var address = 'integrations/google/calendars/' + userID + '/' + teamID;
	FBRef.child(address).off(); // first get rid of any old handlers, since this fn will be called many times
	FBRef.child(address).on('child_removed', function teamChildRemoved(snap) {
		onCalRemoved(snap.key());
		FBRef.child(address).off(); // don't catch multiple child_removeds to this endpoint
	});
}

/**
*
*	gets events from Google API and schedules jobs for them
*
*	- only gets events before the next master job cycle
*	- ensures	that the calendar FBKey is listed in eventJobList
*		even if there are no events this cycle
*	A if event is in the future, schedule its post
*	B if the event started between making the request and receiving the
*		info, post immediately
*	C otherwise, the event may have already been posted and we do nothing
*/
var onCalAdded = function(_oa2Client, calID, calFBKey, userID, teamID, webhookAlreadyRegistered) {
	// ...get all events
	var nextInvocation = masterJob.pendingInvocations()[0].fireDate.toISOString();
	var gCalRequestStartTime = new Date();
	var params = {
		auth : _oa2Client,
		singleEvents: true,
		calendarId : calID,
		timeMax : nextInvocation,
		timeMin : gCalRequestStartTime.toISOString() // now
	};

	// ensure cal evt job list exists (since list is also used as cal registration indicator)
	eventJobList[calFBKey] = eventJobList[calFBKey] || {};

	// make API requests
	// 1. get all events and schedule jobs
	GCal.events.list(params, function(err, res) {
		if (err) return console.log(err);

		// 3. schedule event jobs
		for (var j in res.items) {
			var thisEvent = res.items[j];
			// get start time OR date (for full day events)
			// then make it a date Obj
			var jobStart = 'dateTime' in thisEvent.start ? thisEvent.start.dateTime : thisEvent.start.date + 'T' + DAY_START_TIME + '.000Z';
			jobStart = new Date(jobStart);

			// A schedule the job if it's in the future
			// (this Date will be later than the gcal request start time)
			if (jobStart.getTime() > new Date().getTime()) {
				// console.log('scheduling "' + thisEvent.summary + '" post for', jobStart.toString());
				var job = schedule.scheduleJob(jobStart,
					doEventJob.bind(null, thisEvent, userID, teamID, {calFBKey : calFBKey, eventID : thisEvent.id}) // bind data to callback (see https://github.com/node-schedule/node-schedule#date-based-scheduling)
				);

				if (job != null) {
					// stash job for future cancelling
					eventJobList[calFBKey][thisEvent.id] = job;
				}
			}
			// post immediately if event started between making the request and receiving the info (and a 1sec grace margin)
			else if (jobStart.getTime() > (gCalRequestStartTime.getTime() - 1000)) {
				// console.log('doing immediate post for "' + thisEvent.summary + '"', jobStart.toString(), gCalRequestStartTime.toString());
				doEventJob(thisEvent, userID, teamID, {calFBKey: calFBKey, eventID : thisEvent.id});
			}
			// C do nothing
			else {
				// console.log('"' + thisEvent.summary + '" started in past and not scheduled', jobStart.toString(), gCalRequestStartTime.toString());
			}
		}
		// console.log('cal added, ' + Object.keys(eventJobList).length + ' registered cals', calFBKey);
	});

	// 2. watch for changes to events (register webhook)
	if (!webhookAlreadyRegistered)
		registerWebhookForCalendar(_oa2Client, calID, calFBKey, userID, teamID);
}

/**
*	remove all scheduled jobs for this calendar
*/
var onCalRemoved = function(calFBKey) {
	// cancel all jobs associated with that calendar
	if (calFBKey in eventJobList) {
		for (var i in eventJobList[calFBKey]) {
			if (eventJobList[calFBKey][i] != null && 'cancel' in eventJobList[calFBKey][i]) {
				eventJobList[calFBKey][i].cancel();
				delete eventJobList[calFBKey][i]; // clean up job
			}
		}
	}
	// delete calendar from list
	delete eventJobList[calFBKey];
	// console.log('cal removed, ' +  Object.keys(eventJobList).length + ' registered cals', calFBKey);
}

/*
*	post status a update for the event
*	delete event job from list after it's done
*/
var doEventJob = function(event, userID, teamID, jobKeys) {
	console.log('doEventJob', event.summary, userID, teamID);
	var status = {
		name : 'Event: ' + event.summary,
		time : new Date().getTime(),
		user : userID,
		type : Phased.meta.status.TYPE_ID.CALENDAR_EVENT,
		source: Phased.meta.status.SOURCE_ID.GOOGLE_CALENDAR
	};

	FBRef.child('team/' + teamID + '/statuses').push(status, function(err) {
		if (!err) {
			// console.log('posted');
			FBRef.child('team/' + teamID + '/members/' + userID + '/currentStatus').set(status, function(){
				delete eventJobList[jobKeys.calFBKey][jobKeys.eventID];
			});
		}
	});
}




// Google API utils
// (lifted from googleAuth.controller.js -- not DRY but maybe not worth
// making another module for...)

/**
*
*	registers the webhook for a calendar's registration
*
*/
var registerWebhookForCalendar = function(_oa2Client, calID, calFBKey, userID, teamID) {
	var nextInvocation = masterJob.pendingInvocations()[0].fireDate;

	// token will be embedded to the webhook registration as a query string
	// so we can use this metadata when the webhook is hit
	var token = {
		calFBKey : calFBKey,
		userID : userID,
		teamID : teamID,
		calID : calID
	};
	var channelID = uuid.v1(); // timestamp based random ID

	// save token and channel ID for verification when webhook is hit
	webhookChannelTokens[channelID] = token;

	// register our webhook
	GCal.events.watch({
		auth: _oa2Client,
		calendarId : calID,
		singleEvents : true,
		timeMax : nextInvocation.toISOString().replace('Z', '+00:00'),
		timeMin : new Date().toISOString().replace('Z', '+00:00'),
		resource : {
			id : channelID,
			type: 'web_hook',
			address : config.google.CALENDAR_EVENTS_WEBHOOK_URL,
			token: querystring.stringify(token),
			expiration: nextInvocation.getTime()
		}
	}, function(err, res) {
		if (err)
			console.log('error registering webhook:', err.message);
	});
}

/**
*
* Sets the google oauth2 client credentials
*	for a Phased user (by ther UID)
*
*	returns a promise
*	passes the fulfill method an authorized oauth2Client
*
*/
var setGOA2Creds = function(userID) {
	return new Promise(function(fulfill, reject) {
		getGoogleTokensForUser(userID).then(function(tokens) {
			var _oa2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL); // make client
			_oa2Client.setCredentials(tokens); // authenticate client
			fulfill(_oa2Client); // give callback authed client
		}, function() {
			console.log('could not auth user with Google');
			reject();
		});
	});
}

/**
*
*	Get Google tokens for a user from firebase
*
*/
var getGoogleTokensForUser = function(userID) {
	return new Promise(function(fulfill, reject) {
		FBRef.child('integrations/google/tokens/' + userID).once('value', function (snap) {
			var tokens = snap.val();
			if (tokens) {
				fulfill(tokens);
			} else {
				console.log('no tokens saved for user ' + userID);
				reject();
			}
		}, reject);
	});
}
