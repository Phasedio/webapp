'use strict';

var express = require('express');
var router = express.Router();
var controller = require('./slack.controller');
var phasedSlack = require('./slashcommands.controller');

// auth redirect_uri
router.get('/auth', controller.auth);

// slash commands
router.post('/slash/uit', phasedSlack.uitSlack); // dedicated UIT route
router.post('/slash/update', phasedSlack.update); // /update status
router.post('/slash/tell', phasedSlack.tell); // tell [user] to [task]
router.post('/slash/assign', phasedSlack.assign); // assign [task] to [user]
router.post('/slash/task', phasedSlack.task); // create a [task]
router.post('/slash/status', phasedSlack.status); // get status for user
router.post('/slash/link', phasedSlack.linkUser); // link a user's slack and phased accounts

module.exports = router;