'use strict';

var express = require('express');
var controller = require('./download.controller');

var router = express.Router();

router.get('/', controller.dwl);
router.post('/', controller.send);
router.get('/:file', controller.dwl);

module.exports = router;
