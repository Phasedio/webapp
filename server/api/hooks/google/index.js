'use strict';

var express = require('express');
var router = express.Router();
var controller = require('../../../components/gcal');

router.post('/events', controller.eventPush);

module.exports = router;