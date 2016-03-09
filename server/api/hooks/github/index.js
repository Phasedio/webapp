'use strict';

var express = require('express');
var router = express.Router();
var controller = require('./gh.controller');

router.get('/', controller.index);
router.get('/repo/:team', controller.repoPush);

module.exports = router;