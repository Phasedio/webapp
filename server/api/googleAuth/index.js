'use strict';

var express = require('express');
var router = express.Router();
var controller = require('./googleAuth.controller');

router.get('/', controller.index);
router.get('/auth1', controller.auth1);
router.get('/auth2', controller.auth2);
router.get('/cal', controller.getCals);
router.get('/hasAuth', controller.hasAuth);

module.exports = router;