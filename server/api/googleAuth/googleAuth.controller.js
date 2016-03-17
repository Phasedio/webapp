/**
*	Google authentication
*/

'use strict';
// general vars
// ====
var config = require('../../config/environment');
var Promise = require("promise");

// Firebase vars
// ====
var Firebase = require("firebase");
var FirebaseTokenGenerator = require("firebase-token-generator");

var FBRef = new Firebase("https://phaseddev.firebaseio.com/");
var tokenGenerator = new FirebaseTokenGenerator(config.FB_SECRET_1);
var FBToken = tokenGenerator.createToken({ uid: "gcal-server"});


// Google vars
// ====
var CLIENT_ID = '313573711545-p9bo68ve6d5oih51datnkv1i8vrumipq.apps.googleusercontent.com',
		CLIENT_SECRET = 'vanRqrxMPnlZ2qNpEp4bwDTW',
		REDIRECT_URL = 'https://a882c26d.ngrok.io/api/google/auth2';

var google = require('googleapis');
var OAuth2 = google.auth.OAuth2;

// this global oauth2Client can be used for getting auth tokens
// but a new one should be used for making requests (as it will hold
// a user's tokens internally and so shouldn't be global)
var oauth2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
var scopes = ['https://www.googleapis.com/auth/calendar.readonly'];
var GCal = google.calendar('v3');


// routes
// ====
exports.index = function(req,res) { res.send([]) };

/**
*
*	Authentication step one:
*	generate and redirect to a Google consent URL
*
*/
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

/**
*
*	Authentication step two:
*
*	callback from step one
*	receive access code from google
*	get tokens for access code
*	  save them to DB
*	  save them to session
*	redirect to user's referer from before step 1
*
*/
exports.auth2 = function(req, res) {
	oauth2Client.getToken(req.query.code, function(err, tokens) {
		if (!err) {
			req.session.tokens = tokens;
			saveUserTokens(req.session.user, tokens);
		} else {
			console.log(err);
		}

		// send respose after tokens saved to session
		if (req.session.referer)
			res.redirect(req.session.referer);
		else
			res.status(200).end();
	});
}

/**
*
*	GET /api/google/cal
*
*	1. check Google auth
* 2. get calendars from google endpoint
*		using google oauth2Client
*	3. return in same format to client
*
*/
exports.getCals = function(req, res) {
	// 1. a.
	setGOA2Creds(req).then(
		function success(authClient) {
			// 2.
			GCal.calendarList.list({
				auth: authClient
			}, function(err, response) {
				if (response) {
					res.status(200).send(response.items);
				} else {
					console.log(err);
					res.status(err.code).send(err);
				}
			});
		},
		function failure() {
			res.status(401).send('Unauthorized').end();
		}
	);
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
		FBRef.authWithCustomToken(FBToken, function(error) {
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
		FBRef.authWithCustomToken(FBToken, function(error) {
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

/**
*
* Sets the google oauth2 client credentials
*
*	1. if we have session creds, use those
*	2. otherwise get from DB
*	3. otherwise reject promise
*	
*	returns a promise (due to async FB call)
*	passes the fulfill method an authorized oauth2Client
*	(that isn't in the global scope) to make this request
*
*/
var setGOA2Creds = function(req) {
	return new Promise(function(fulfill, reject) {
		var _oa2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);
		// 1.
		if (req.session && 'tokens' in req.session && 'refresh_token' in req.session) {
			_oa2Client.setCredentials(req.session.tokens); // user session tokens to auth client
			fulfill(_oa2Client); // give callback authed client
			return;
		} else {
			console.log('user tokens not in session, retrieving from DB');
			FBRef.authWithCustomToken(FBToken, function(error) {
				FBRef.child('integrations/google/tokens/' + req.session.user.uid).once('value', function (snap) {
					var tokens = snap.val();
					if (tokens) {
						req.session.tokens = tokens; // save DB tokens to session
						_oa2Client.setCredentials(tokens); // authorize client
						fulfill(_oa2Client); // give callback authed client
					} else {
						console.log('no tokens in DB, failing');
						reject();
					}
				});
			});
		}
	});
}