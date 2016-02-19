'use strict';

var express = require('express');
var router = express.Router();
var controller = require('./registration.controller');

router.get('/', controller.index);
router.post('/registerTeam', controller.registerTeam);
router.post('/register', controller.register);
router.post('/invite', controller.invite);

module.exports = router;