/**
*	Slack authentication
*/

'use strict';
// general vars
// ====
var config = require('../../config/environment');
var request = require('request');

// Firebase vars
// ====
var Firebase = require("firebase");
var FirebaseTokenGenerator = require("firebase-token-generator");

var FBRef = new Firebase("https://phaseddev.firebaseio.com/");
var tokenGenerator = new FirebaseTokenGenerator(config.FB_SECRET_1);
var FBToken = tokenGenerator.createToken({ uid: "slack-server"});



/**
*
*	User redirected here after slack auth handshake
*
*	need to 
*		1. make a post request to exchange access code for an OAuth token
*		2. stash that token with the team's ID in the /integrations/slack/teams DB
*		3. stash the slack ID to the team's /team/[id]/integrations key
*
*/
exports.auth = function (req, res) {
	console.log('hit', req.query);
	res.redirect('/'); // send the user back to the app QUICKLY

	// 1.
	var opts = {
		url : 'https://slack.com/api/oauth.access',
		method : 'POST',
		json : true,
		qs : {
			code : req.query.code,
			client_id : config.slack.CLIENT_ID,
			client_secret : config.slack.CLIENT_SECRET,
			redirect_uri : config.slack.REDIRECT_URL // this route
		}
	}

	request(opts, function(error, message, data) {
		// 2.
		if (error || !data || !data.ok) {
			console.log('Error with Slack authentication', (error || data.error));
			return;
		}

		if (!('user' in req.session) || !('uid' in req.session.user)) {
			console.log('No session user, cannot save Slack token');
			return;
		}

		FBRef.authWithCustomToken(FBToken, function(error, authData) {
			if (error) {
				console.log("FireBase auth failed!", error);
				return;
			}
			// we only have user ID, need to get team they just authed Slack on behalf of
			var sessionUser = req.session.user;

			// straightforward
			if (sessionUser.provider == 'password') {
				saveAuthTokensForUserTeam(sessionUser.uid, data);
			} else {
				// get user's actual uid
				FBRef.child('userMappings/' + sessionUser.uid).once('value', function(snap) {
					var userID = snap.val();
					if (!userID) {
						console.log('No mapped UID for user requesting Slack integration');
						return;
					} else {
						saveAuthTokensForUserTeam(userID, data);
					}
				}, maybeLogErr);
			}

		});

	});
}


/**
*
* 1.	Get user's current team
*	2. Save their slack ID to their /team key
*	3. Save their slack tokens and team ID to their /integrations key
*	Rejoice
*
*/
var saveAuthTokensForUserTeam = function(userID, slackResponse) {
	// 1. get current team
	FBRef.child('profile/' + userID + '/curTeam').once('value', function(snap) {
		var teamID = snap.val();
		console.log('teamID', teamID);

		if (!teamID) {
			console.log('No curTeam for Slack authenticating user');
			return;
		}

		// 2.
		FBRef.child('team/' + teamID + '/slack').set({
			teamName : slackResponse.team_name,
			teamID : slackResponse.team_id
		}, maybeLogErr);

		// 3. 
		FBRef.child('integrations/slack/teams/' + slackResponse.team_id).set({
			teamID : teamID,
			token : slackResponse.access_token
		}, maybeLogErr);
	});
}


var maybeLogErr = function(error) {
	if (error) console.log(error);
}