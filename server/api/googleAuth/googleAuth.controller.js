/**
*	Google authentication
*/

'use strict';
// general vars
// ====
var config = require('../../config/environment');
var Promise = require("promise");
var FBRef = require('../../components/phasedFBRef').getRef();

// Google vars
// ====
var CLIENT_ID = config.google.CLIENT_ID,
		CLIENT_SECRET = config.google.CLIENT_SECRET,
		REDIRECT_URL = config.google.REDIRECT_URL;

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
		if (req.headers.referer)
			res.redirect(req.headers.referer);
		else
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
*	Check if the user has google token saved anywhere
*
*/
exports.hasAuth = function(req, res) {
	getGoogleTokensForUser(req).then(function(tokens){
		res.send(true);
	}, function(){
		res.send(false);
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
			res.status(401).send('Unauthorized');
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
		FBRef.child('userMappings/' + user.uid + '/' + user.provider).once('value', function(snap){
			var properID = snap.val();
			if (!properID) {
				console.log('Bad user! They might be gaming us...');
				return;
			}

			// 2. we have the proper UID, moving on
			updateUserTokens(uid, tokens);
		});
	} else {
		updateUserTokens(user.uid, tokens);
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
*	returns a promise
*	passes the fulfill method an authorized oauth2Client
*
*/
var setGOA2Creds = function(req) {
	return new Promise(function(fulfill, reject) {
		getGoogleTokensForUser(req).then(function(tokens) {
			var _oa2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL); // make client
			_oa2Client.setCredentials(tokens); // authenticate client
			fulfill(_oa2Client); // give callback authed client
		}, reject);
	});
}

/**
*
*	Get Google tokens for a user that has them anywhere
*	If they're in the session, use those
*	If they're in the DB, use those
*	Otherwise, reject the promise
*
*/
var getGoogleTokensForUser = function(req) {
	return new Promise(function(fulfill, reject) {
		// 1. check session. needs to have refresh_token
		if (req.session && 'tokens' in req.session && 'refresh_token' in req.session) {
			fulfill(req.session.user.tokens);
			return;
		} else if ('user' in req.session && 'uid' in req.session.user && req.session.user.uid !== undefined) {
			// 2. check DB
			FBRef.child('integrations/google/tokens/' + req.session.user.uid).once('value', function (snap) {
				var tokens = snap.val();
				if (tokens) {
					req.session.tokens = tokens; // save DB tokens to session
					fulfill(tokens);
				} else {
					console.log('no tokens in DB, failing');
					reject();
				}
			});
		} else {
			console.log('no session user or uid, cannot get google auth tokens', req.session.user);
			reject();
		}
	});
}