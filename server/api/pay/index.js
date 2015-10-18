'use strict';

var express = require('express');
var controller = require('./pay.controller');

var router = express.Router();

router.get('/', controller.index);

router.post('/', controller.create);
router.post('/create', controller.create);

module.exports = router;