'use strict';

var express = require('express');
var router = express.Router();
var controller = require('./slack.controller');

router.get('/auth', controller.auth);

module.exports = router;