/**
 * GCal task scheduling
 */

'use strict';

// Firebase business
var Firebase = require("firebase");
var FirebaseTokenGenerator = require("firebase-token-generator");

var FBRef = new Firebase("https://phaseddev.firebaseio.com/");
var tokenGenerator = new FirebaseTokenGenerator("0ezGAN4NOlR9NxVR5p2P1SQvSN4c4hUStlxdnohh");
var token = tokenGenerator.createToken({ uid: "gcal-server"});

module.exports = function init() {
	console.log('starting GCal task scheduling');
	getCals(getEvents);
};

/**
	gets calendar events for all users from FB
	passes them to callback
*/
var getCals = function(cb) {

	// do after authenticated
	FBRef.authWithCustomToken(token, function(error, authData) {
		// fail if error
		if (error) {
			console.log(error);
			res.status(202).end();
			return;
		}
		FBRef.child('calendars').on('child_added', function(snap) {
			var cals = snap.val();
			var uid = snap.key();
			console.log(uid, cals);

			cb(uid, cals, watchEvents);
		})
	});
}

/**
	gets events for a user's calendars
	from the Google API
	passes them to callback
*/
var getEvents = function(uid, cals, cb) {
	console.log('gettings events for cals');
	for (var teamID in cals) {
		for (var i in cals[teamID]) {
			var cal = cals[teamID][i];
			console.log(cal.name + ' is ' + cal.id);
		}
	}
}

/**
	schedules a function to run at the start time for each 
	event in the list passed to it
*/
var watchEvents = function(events) {

}