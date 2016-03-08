'use strict';

var express = require('express');
var router = express.Router();
var controller = require('./gh.controller');

router.get('/', controller.index);
router.get('/auth', controller.auth);
router.get('/auth2', controller.auth2);
router.get('/repopush', controller.repoPush);

module.exports = router;