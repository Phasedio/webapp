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
	eventJobList = {}; // organized by calendar for cancelling later (ie, eventJobList[calID] = [job, job, ...])

module.exports = function init() {
	console.log('starting GCal task scheduling');

	// using the rule means the job will recur
	// using a date object will only run the job once
	var rule = {
		hour : 2, // start scheduling the day's events at 2AM
		minute : 0 // leaving this null would run the job every minute!
	};

	masterJob = schedule.scheduleJob(rule, doMasterJob);
	// console.log(masterJob.pendingInvocations()[0].fireDate);
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
	console.log('doMasterJob');
	// do after authenticated
	FBRef.authWithCustomToken(FBToken, function(error, authData) {
		// fail if error
		if (error)
			return console.error('GCal schedule not running this time round due to Firebase auth error, will try again at ' + masterJob.pendingInvocations()[0].fireDate, error);

		FBRef.child('integrations/google/calendars').on('child_added', onCalAdd);
		FBRef.child('integrations/google/calendars').on('child_removed', onCalRemoved);
	});
}

/*
	1. get Google credentials for user
	2. get all events for each calendar on each team before next main job invocation
	3. schedule doEventJob for each event
*/
var onCalAdd = function(snap) {
	console.log('onCalAdd');
	// 1. first, get an authenticated google client
	var userID = snap.key();
	setGOA2Creds(userID).then(
		function success(_oa2Client) {
			// 2. now, for each calendar on each team...
			var calsByTeam = snap.val(); // list of calendars by team
			for (var teamID in calsByTeam) {
				var teamCals = calsByTeam[teamID]; // list of calendars this user has registered to be updated for this team
				for (var i in teamCals) {

					// ...get all events
					var cal = teamCals[i]; // the calendar
					var nextInvocation = masterJob.pendingInvocations()[0].fireDate.toISOString();
					var params = {
						auth : _oa2Client,
						singleEvents: true,
						calendarId : cal.id,
						timeMax : nextInvocation,
						timeMin : (new Date()).toISOString() // now
					};

					// make API request
					GCal.events.list(params, function(err, res) {
						if (err) return console.log(err);

						// 3. schedule event
						console.log(cal.id + ' events:');
						console.log(res.items);	
					});
				}
			}
		},
		function failure() {
			console.log('Could not authenticate user');
		});
	
}

/*
	- remove all scheduled jobs for this calendar
		- loop through eventJobList, remove all events for this cal
*/
var onCalRemoved = function(snap) {
	console.log('onCalRemoved');
}

/*
	- (check that the event still exists)
	- post status update
*/
var doEventJob = function() {
	console.log('doEventJob');
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
		}, reject);
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