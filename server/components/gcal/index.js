/**
 * GCal task scheduling
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

// Firebase business
// ====
var FBRef = new Firebase("https://phaseddev.firebaseio.com/");
var tokenGenerator = new FirebaseTokenGenerator(config.FB_SECRET_1);
var FBToken = tokenGenerator.createToken({ uid: "gcal-server"}); 

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
	
	// time at which statuses should be posted for all day events. IN GMT!!! 24h, HH:MM:SS
	// maybe a better solution to this. (ie, get timezone from calendar)
	DAY_START_TIME = '12:00:00'; // 8AM EST

module.exports = function init() {
	console.log('starting GCal task scheduling');

	// using the rule means the job will recur
	// using a date object will only run the job once
	var rule = {
		hour : 2, // start scheduling the day's events at 2AM
		minute : 0 // leaving this null would run the job every minute!
	};

	// run the master job every 5 minutes to test
	if (config.env === 'development')
		rule = '*/1 * * * *';

	masterJob = schedule.scheduleJob(rule, doMasterJob);
	masterJob.job(); // invoke job immediately as well as when scheduled

	schedule.scheduleJob('*/5 * * * *', function(){
		console.log('scheduled jobs:', eventJobList);
	});
};

/*
	- 1. Authenticate with firebase
	- 2. Remove last round's .on() & eventJobList (there should be none outstanding and we need to re-gather all calendars anyway)
	- 3. FB.on to monitor calendars:
		- onUserAdd/Removed registers handlers for cals added/removed (also takes care of nesting by teams)
*/
var doMasterJob = function() {
	console.log('executing masterJob; next iteration at ', masterJob.pendingInvocations()[0].fireDate.toString());

	// 1. do after authenticated
	FBRef.authWithCustomToken(FBToken, function(error, authData) {
		// fail if error
		if (error)
			return console.log('GCal schedule not running this time round due to Firebase auth error, will try again next time.', error);
		
		// 2.
		FBRef.child('integrations/google/calendars').off(); // kills all event handlers
		eventJobList = {}; // clear job list; 

		// 3. get this party started
		console.log('get this party started');
		FBRef.child('integrations/google/calendars').on('child_added', onUserAdd, function(err){
			console.log('err', err);
		});
		FBRef.child('integrations/google/calendars').on('child_removed', onUserRemoved, function(err){
			console.log('err', err);
		});
	}, function(err) {
		console.log('err', err);
	});
}

/**
*
* registers all events for all cals for all teams on this user
*
*	1. immediately register all present calendars
*	2. listen for changes and register all newly added calendars
*			(using child_changed instead of child_added because it covers
*			new calendars on known teams as well as new teams)	
*
*/
var onUserAdd = function(snap) {
	var userID = snap.key(),
		calsByTeam = snap.val();

	// 1. set up initial scheduling
	setGOA2Creds(userID).then(function success(_oa2Client) {
		for (var teamID in calsByTeam) {
			registerCalsForTeam(_oa2Client, calsByTeam[teamID], userID, teamID);
		}
	});

	// 2. future-proofing: whenever the user's calendar registration changes
	FBRef.child('integrations/google/calendars/' + userID).on('child_changed', function onTeamChanged(snap) {
		var teamID = snap.key(),
			cals = snap.val();
		// register new cals
		setGOA2Creds(userID).then(function success(_oa2Client) {
			registerCalsForTeam(_oa2Client, cals, userID, teamID);
		});
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
	console.log('registering ' + Object.keys(cals).length + ' cals for ' + userID);
	for (var calFBKey in cals) {
		if (!(calFBKey in eventJobList)) {
			// 1. schedule jobs for calendar events
			onCalAdded(_oa2Client, cals[calFBKey], calFBKey, userID, teamID);
		}
	}

	// 2. watch team for calendar deregistration
	var address = 'integrations/google/calendars/' + userID + '/' + teamID;
	FBRef.child(address).off(); // first get rid of any old handlers, since this fn will be called many times
	FBRef.child(address).on('child_removed', function teamChildRemoved(snap){
		onCalRemoved(snap.key());
	});
}

/**
*
*	gets events from Google API and schedules jobs for them
*
*	- only gets events before the next master job cycle
*	- ensures	that the calendar FBKey is listed in eventJobList
*		even if there are no events this cycle
*/
var onCalAdded = function(_oa2Client, cal, calFBKey, userID, teamID) {
	// ...get all events
	var nextInvocation = masterJob.pendingInvocations()[0].fireDate.toISOString();
	var params = {
		auth : _oa2Client,
		singleEvents: true,
		calendarId : cal.id,
		timeMax : nextInvocation,
		timeMin : (new Date()).toISOString() // now
	};

	// ensure cal evt job list exists (since list is also used as cal registration indicator)
	eventJobList[calFBKey] = eventJobList[calFBKey] || {};

	// make API request
	GCal.events.list(params, function(err, res) {
		if (err) return console.log(err);

		// 3. schedule event jobs
		for (var j in res.items) {
			var thisEvent = res.items[j];
			// get start time OR date (for full day events)
			// then make it a date Obj
			var jobStart = 'dateTime' in thisEvent.start ? thisEvent.start.dateTime : thisEvent.start.date + 'T' + DAY_START_TIME + '.000Z';
			jobStart = new Date(jobStart);

			// only schedule the job if it's in the future
			if (jobStart.getTime() > new Date().getTime()) {
				console.log('scheduling "' + thisEvent.summary + '" post for', jobStart.toString());
				var job = schedule.scheduleJob(jobStart,
					doEventJob.bind(null, thisEvent, userID, teamID, {calFBKey : calFBKey, eventID : thisEvent.id}) // bind data to callback (see https://github.com/node-schedule/node-schedule#date-based-scheduling)
				);
				
				if (job != null) {
					// stash job for future cancelling
					eventJobList[calFBKey][thisEvent.id] = job;
				}
			} else {
				console.log('"' + thisEvent.summary + '" in past and not scheduled', jobStart.toString(), new Date().toString());
			}
		}
		console.log('cal added, ' + Object.keys(eventJobList).length + ' registered cals');
	});
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
	console.log('cal removed, ' +  Object.keys(eventJobList).length + ' registered cals');
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
		user : userID
	};
	// do after authenticated
	FBRef.authWithCustomToken(FBToken, function(error, authData) {
		// fail if error
		if (error)
			return console.error('Could not post status because FB won\'t auth.', error);

		FBRef.child('team/' + teamID + '/statuses').push(status, function(err) {
			if (!err) {
				console.log('posted');
				FBRef.child('team/' + teamID + '/members/' + userID + '/currentStatus').set(status, function(){
					delete eventJobList[jobKeys.calFBKey][jobKeys.eventID];
				});
			}
		});
	});
}




// Google API utils
// (lifted from googleAuth.controller.js -- not DRY but maybe not worth
// making another module for...)

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