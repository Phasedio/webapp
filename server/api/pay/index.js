'use strict';

var express = require('express');
var controller = require('./pay.controller');

var router = express.Router();

router.get('/', controller.index);

router.post('/', controller.create);
router.post('/create', controller.create);
router.post('/find', controller.find);

module.exports = router;