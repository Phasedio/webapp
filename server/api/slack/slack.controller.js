/**
*	Slack authentication
*/

'use strict';
// general vars
// ====
var config = require('../../config/environment');
var request = require('request');
request.debug = true;

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
	// res.status(200).end();

	// 1.
	var opts = {
		url : 'https://slack.com/api/oauth.access',
		method : 'POST',
		json: true,
		body : {
			code : req.query.code,
			client_id : config.slack.CLIENT_ID,
			client_secret : config.slack.CLIENT_SECRET,
			redirect_uri : config.slack.REDIRECT_URL // this route
		}
	}

	console.log('requesting with opts', opts);

	request(opts, function(error, message, data) {

		// 2.
		console.log('response error', error);
		// console.log(message.method, message.rawHeaders);
		console.log('response data', data);

		if (error || !data || !data.ok) {
			res.redirect('/');
			return;
		}

		FBRef.authWithCustomToken(FBToken, function(error, authData) {
			if (error) {
				console.log("FireBase auth failed!", error);
				return;
			}

			// FBRef.child('team/')

		});

	});
}