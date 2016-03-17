/**
*	Google authentication
*/

'use strict';
// gen vars
// ====
var config = require('../../config/environment');

// Firebase vars
// ====
var Firebase = require("firebase");
var FirebaseTokenGenerator = require("firebase-token-generator");

var FBRef = new Firebase("https://phaseddev.firebaseio.com/");
var tokenGenerator = new FirebaseTokenGenerator(config.FB_SECRET_1);
var token = tokenGenerator.createToken({ uid: "gcal-server"});


// Google vars
// ====
var CLIENT_ID = '313573711545-p9bo68ve6d5oih51datnkv1i8vrumipq.apps.googleusercontent.com',
		CLIENT_SECRET = 'vanRqrxMPnlZ2qNpEp4bwDTW',
		REDIRECT_URL = 'http://93aa8d5a.ngrok.io/api/googleAuth/auth2';

var google = require('googleapis');
var OAuth2 = google.auth.OAuth2;

var oauth2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
var scopes = ['https://www.googleapis.com/auth/calendar.readonly'];


// routes
// ====
exports.index = function(req,res) { res.send([]) };

exports.auth1 = function(req, res) {
	if (!req.session.user) {
		console.log('Cannot process Google authorization, no session user');
		res.end();
		return;
	}

	req.session.referer = req.headers.referer;	
	var url = oauth2Client.generateAuthUrl({
	  access_type: 'offline', // 'online' (default) or 'offline' (gets refresh_token)
	  scope: scopes // If you only need one scope you can pass it as string
	});
	res.redirect(url);
}

exports.auth2 = function(req, res) {
	oauth2Client.getToken(req.query.code, function(err, tokens) {
		if (!err) {
			req.session.tokens = tokens;
			saveUserTokens(req.session.user, tokens);
		} else {
			console.log('error:', err);
		}
	});

	if (req.session.referer)
		res.redirect(req.session.referer);
	else
		res.status(200).end();
}

// internal business functions
// ====

/**
*
*	Saves a user's Google API OAuth tokens
*	for the automated service to use later
*
*	NB: Google only gives the refresh_token if the user
*	is prompted. We can force the prompt but it's better
*	to avoid. Long story short, we CANNOT lose the refresh_token!
*
*	var user == req.session.user or req.user.d
*	var tokens == tokens from oauth2Client.getToken
*
*	1. checks provider. if provider isn't password,
*			gets proper UID from userMappings
*	2. updates FB tokens key
*			integrations/google/tokens/$uid/google = tokens
*
*/
var saveUserTokens = function(user, tokens) {
	if (!user || !tokens) {
		return;
	}
	// 1.
	if (user.provider !== 'password') {
		FBRef.authWithCustomToken(token, function(error, authData) {
			if (error) {
				console.log(error);
				return;
			}

			FBRef.child('userMappings/' + user.uid + '/' + user.provider).once('value', function(snap){
				var properID = snap.val();
				if (!properID) {
					console.log('Bad user! They might be gaming us...');
					return;
				}

				// 2. we have the proper UID, moving on
				updateUserTokens(uid, tokens);
			});
		});
	} else {
		FBRef.authWithCustomToken(token, function(error, authData) {
			if (error) {
				console.log(error);
				return;
			}
			updateUserTokens(user.uid, tokens);
		});
	}

	var updateUserTokens = function(uid, tokens) {
		// uses update to not accidentally overwrite refresh token
		FBRef.child('integrations/google/tokens/' + uid).update(tokens);
		console.log('tokens updated');
	}
}