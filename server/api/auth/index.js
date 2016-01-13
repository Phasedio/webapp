'use strict';

var express = require('express');
var router = express.Router();
var controller = require('./auth.controller');

router.get('/', controller.index);
router.post('/roles', controller.roles);

module.exports = router;