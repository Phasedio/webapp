'use strict';
var config = require('../../../config/environment');
var FBRef = require('../../../components/phasedFBRef').getRef();
var Phased = require('../../../components/phased');

var GHClientID = '84542af1ca986f17bd26';
var GHClientSecret = '8f6d49d7be3e358ec229c97967055ce9551e122d';
var auth1RedirectURI = 'http://localhost:9000/api/gh/auth2';
var scope = 'repo';
var state = 'd7b6f8537c577945a06b1e916ad2c0bb'; // md5 of 'Phased.io'

exports.index = function(req, res) {
	res.json([]);
};

/**
*
* ACCEPTS GITHUB REPO PUSH WEBHOOK EVENTS
* 1. check / validate data (https:*developer.github.com/v3/activity/events/types/#pushevent)
* 	ensure team specified in URL param
* 		a) exists
* 		b) has the repo registered
* 		c) has the 'push' hook registered
*
* 2. check team members to see if any are associated with the event's pusher
* 	(stored at team/members/$member/aliases/github)
*
* 3. post a named or anonymous status update to the team
*
*	4. issue a team-wide notification
*
*/
exports.repoPush = function(req, res) {
	// This header sniffing is a BAD EXCUSE FOR SECURITY
	// and should be replaced with https://developer.github.com/webhooks/securing/
	if (req.headers['user-agent'].indexOf('GitHub-Hookshot') !== 0) {
		res.status(404).end(); // send 404 to imitate not actually being here
		return;
	}

	if ('zen' in req.body) { // gh ping event whenever hook is registered
		console.log(req.body.zen + ' (courtesy ' + req.headers['user-agent'] + ')');
		res.status(202).end();
		return;
	}

	if (!('repository' in req.body)) { // no repo!
		console.log('no repo, bad request');
		res.status(400).end();
		return;
	}

	console.log('repoPush');

	// do after authenticated
	var teamID = req.params.team;
	var pushEvent = req.body;
	// console.log('repopush', teamID);
	console.log('pushEvent', req.body.repository.name + ': ' + req.body.head_commit.message);

	// 0. try to get team
	FBRef.child('team/' + teamID).once('value', function(snap) {
		var team = snap.val();

		// 1. a) b) & c)
		if (
			!team // team doesn't exist
			|| !( pushEvent.repository.id in team.repos ) // repo not registered to team
			|| !('push' in team.repos[pushEvent.repository.id].acceptedHooks) // 'push' hook not registered on repo for team
			) {
			var name = pushEvent && 'repository' in pushEvent ? pushEvent.repository.name : 'repository';
			console.log(name + ' not registered, end');
			res.status(202).end();
			return;
		}

		// 2. check all members
		var thePusher = false; // user ID
		for (var i in team.members) {
			if ('aliases' in team.members[i] && 'github' in team.members[i].aliases) {
				for (var j in team.members[i].aliases.github) {
					if (team.members[i].aliases.github[j] == pushEvent.head_commit.committer.username) {
						thePusher = i;
						break; // for j
						break; // for i
					}
				}
			}
		}

		if (!thePusher) {
			console.log('GH user ' + pushEvent.head_commit.committer.username + ' not found in team; aborting.');
			res.status(202).end();
			return;
		}

		// 3.
		var statusText = pushEvent.pusher.name + ' pushed ' + pushEvent.commits.length + ' commits to ' + pushEvent.repository.name;
		statusText += ' ("' + pushEvent.head_commit.message + '")';
		var newStatus = {
			name: statusText,
			time: pushEvent.pushed_at || new Date().getTime(),
			user: thePusher, // ID or false
			type: Phased.meta.status.TYPE.REPO_PUSH,
			source: Phased.meta.status.SOURCE.GITHUB
		};

		console.log('updating status: ' + statusText);
		FBRef.child('team/' + teamID + '/statuses').push(newStatus);
		if (thePusher)
			FBRef.child('team/' + teamID + '/members/' + thePusher + '/currentStatus').set(newStatus);
		console.log('status updated');

		// 4. issue notification — TODO

		// END
		res.status(202).end();
	}, function(err) {
		console.log(err);
	});
}