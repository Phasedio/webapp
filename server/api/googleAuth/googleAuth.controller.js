/**
*	Google authentication
*/

'use strict';

var CLIENT_ID = '313573711545-p9bo68ve6d5oih51datnkv1i8vrumipq.apps.googleusercontent.com',
		CLIENT_SECRET = 'vanRqrxMPnlZ2qNpEp4bwDTW',
		REDIRECT_URL = 'http://a05c1006.ngrok.io/api/googleAuth/auth2';

var google = require('googleapis');
var OAuth2 = google.auth.OAuth2;

var oauth2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);

// generate a url that asks permissions for Google+ and Google Calendar scopes
var scopes = [
  'https://www.googleapis.com/auth/calendar.readonly'
];

exports.index = function(req,res) { res.send([]) };

exports.auth1 = function(req, res) {
	var url = oauth2Client.generateAuthUrl({
	  access_type: 'offline', // 'online' (default) or 'offline' (gets refresh_token)
	  scope: scopes // If you only need one scope you can pass it as string
	});
	res.redirect(url);
}

exports.auth2 = function(req, res) {
	console.log('auth2 auth code:', req.query.code);
	// console.dir(req.data);

	oauth2Client.getToken(req.query.code, function(err, tokens) {
		if (!err) {
			oauth2Client.setCredentials(tokens);
		} else {
			console.log(err);
		}
	});
	res.status(200).end();
}