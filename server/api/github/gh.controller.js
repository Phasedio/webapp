'use strict';

// Firebase business
// copied from pushserver
var Firebase = require("firebase");
var FirebaseTokenGenerator = require("firebase-token-generator");
var https = require('https');

var FBRef = new Firebase("https://phaseddev.firebaseio.com/");
var tokenGenerator = new FirebaseTokenGenerator("0ezGAN4NOlR9NxVR5p2P1SQvSN4c4hUStlxdnohh");
var token = tokenGenerator.createToken({ uid: "gh-server"});
var GHClientID = '84542af1ca986f17bd26';
var GHClientSecret = '8f6d49d7be3e358ec229c97967055ce9551e122d';
var auth1RedirectURI = 'http://localhost:9000/api/gh/auth2';
var scope = 'repo';
var state = 'd7b6f8537c577945a06b1e916ad2c0bb'; // md5 of 'Phased.io'

exports.index = function(req, res) {
	res.json([]);
};

// endpoint is actually a redirect to GH auth page to begin OAuth process
exports.auth = function(req, res) {
	console.log('auth');

	var path = 'https://github.com/login/oauth/authorize?';
	path += 'client_id=' + encodeURIComponent(GHClientID) + '&';
	path += 'redirect_uri=' + encodeURIComponent(auth1RedirectURI) + '&';
	path += 'scope=' + encodeURIComponent(scope) + '&';
	path += 'state=' + state;

	res.redirect(path);
}

// GH server sends user here with a temporary auth token from above step
exports.auth2 = function(req, res) {
	var _tmp_code = req.query.code,
		_state = req.query.state;

	// if states are same, code is safe to request an auth token
	if (_state = state) {
		// do a post to request a token
		var req_data = JSON.stringify({
			client_id : GHClientID,
			client_secret : GHClientSecret,
			code : _tmp_code,
			state : state
		});
		var post_options = {
			host : 'github.com',
			port: 443,
			path : '/login/oauth/access_token',
			method: 'POST',
			headers : {
				'Content-Type': 'application/json',
				'Content-Length' : req_data.length,
				'Accept' : 'application/json'
			}
		}
		var _req = https.request(post_options, function(_res) {
			// handle post response
			_res.on('data', function(chunk){
				var _data = JSON.parse('' + chunk);
				var _token = _data.access_token,
					_scope = _data.scope;
				console.log('Token retrieved! time to do some stuff');
				res.redirect('localhost:9000/integrations');

				// first check incoming scopes to ensure user has allowed us to use the data we want
				// maybe save the auth token to the session
				// then save repos to user FB key. 
					// (these will be the user's personal repos as well as the organization ones)

			});
		});
		_req.write(req_data);
		_req.end();
	} else {
		// things failed; keep user on page
		// TODO : set error message here
		res.redirect('localhost:9000/integrations');
	}
}


// webhook for repo push updates
exports.repoPush = function(req, res) {
	
}