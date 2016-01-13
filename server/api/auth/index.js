'use strict';

var express = require('express');
var router = express.Router();
var controller = require('./auth.controller');

router.get('/', controller.index);
router.post('/role/get', controller.getRole);
router.post('/role/set', controller.setRole);

module.exports = router;