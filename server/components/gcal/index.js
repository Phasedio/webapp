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
	eventJobList = {}, // organized by calendar for cancelling later (ie, eventJobList[calID] = [job, job, ...])
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

	masterJob = schedule.scheduleJob(rule, doMasterJob);
	masterJob.job(); // invoke job immediately as well as when scheduled
};

/*
	- Authenticate with firebase
	- FB.on to monitor calendars
		- whenever calendar added (incl when initiating),
			do onCalAdd
		- whenever calendar removed, do onCalRemoved
	- remove last FB.on handler
	- stash this handler for next iteration to remove
*/
var doMasterJob = function() {
	console.log('executing masterJob; next iteration at ', masterJob.pendingInvocations()[0].fireDate.toString());
	// do after authenticated
	FBRef.authWithCustomToken(FBToken, function(error, authData) {
		// fail if error
		if (error)
			return console.error('GCal schedule not running this time round due to Firebase auth error, will try again next time.', error);

		FBRef.child('integrations/google/calendars').on('child_added', onUserAdd, console.log);
		FBRef.child('integrations/google/calendars').on('child_removed', onUserRemoved, console.log);
	});
}

/*
	1. get Google credentials for user
	2. get all events for each calendar on each team before next main job invocation
	3. schedule doEventJob for each event
*/
var onUserAdd = function(snap) {
	console.log('onUserAdd', snap.val());
	var userID = snap.key(),
		calsByTeam = snap.val();

	// set up initial scheduling
	setGOA2Creds(userID).then(function success(_oa2Client) {
		for (var teamID in calsByTeam) {
			registerCalsForTeam(_oa2Client, calsByTeam[teamID], userID, teamID);
		}
	});

	// future-proofing: whenever the user's calendar registration changes
	FBRef.child('integrations/google/calendars/' + userID).on('child_changed', function onTeamChanged(snap) {
		var teamID = snap.key(),
			cals = snap.val();
		// register new cals
		setGOA2Creds(userID).then(function success(_oa2Client) {
			registerCalsForTeam(_oa2Client, cals, userID, teamID);
		});
	});

	/*
		only register calendars that aren't already registered
	*/
	var registerCalsForTeam = function(_oa2Client, cals, userID, teamID) {
		for (var i in cals) {
			if (!(cals[i].id in eventJobList)) {
				getAndRegisterEventsForCalendar(_oa2Client, cals[i], userID, teamID);

				// watch newly registered cal for deregistration
				FBRef.child('integrations/google/calendars/' + userID + '/' + teamID).on('child_removed', function teamChildRemoved(snap){
					onCalRemoved(snap.val().id);
					FBRef.child('integrations/google/calendars/' + userID + '/' + teamID).off(); // stop watching for deregistration
				});
			}
		}
	}
}

// deregister all events for all cals for all teams on this user
var onUserRemoved = function(snap) {
	var userID = snap.key();
	console.log(userID + ' rm', snap.val());
	FBRef.child('integrations/google/calendars/' + userID).off(); // stop listening for this user's data

	var teams = snap.val();
	for (var teamID in teams) {
		for (var i in teams[teamID])
			onCalRemoved(teams[teamID][i].id);
	}
}

/**
*
*	gets events from Google API and schedules jobs for them
*
*/
var getAndRegisterEventsForCalendar = function(_oa2Client, cal, userID, teamID) {
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
	eventJobList[cal.id] = eventJobList[cal.id] || {};

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

			// schedule the job
			var job = schedule.scheduleJob(jobStart,
				doEventJob.bind(null, thisEvent, userID, teamID) // bind data to callback (see https://github.com/node-schedule/node-schedule#date-based-scheduling)
			);
			
			// stash job for future cancelling
			eventJobList[cal.id][thisEvent.id] = job;
		}
		console.log('all events in cycle for calendar ' + cal.id + ' registered, calendars with pending jobs:', Object.keys(eventJobList));
	});
}

/*
	- remove all scheduled jobs for this calendar
		- loop through eventJobList, remove all events for this cal
	NB: uses GCal ID, not FB key!
*/
var onCalRemoved = function(calID) {
	// cancel all jobs associated with that calendar
	if (calID in eventJobList) {
		for (var i in eventJobList[calID]) {
			if (eventJobList[calID][i] != null && 'cancel' in eventJobList[calID][i]) {
				eventJobList[calID][i].cancel();
				delete eventJobList[calID][i]; // clean up job
			}
		}
	}

	// delete calendar from list
	delete eventJobList[calID];
	console.log(calID + ' removed, pending jobs', Object.keys(eventJobList));
}
 
/*
	post status update for the event
*/
var doEventJob = function(event, userID, teamID) {
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
				FBRef.child('team/' + teamID + '/members/' + userID + '/currentStatus').set(status);
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