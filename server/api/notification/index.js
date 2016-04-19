'use strict';

var express = require('express');
var router = express.Router();
var controller = require('./notification.controller');

router.get('/', controller.index);
router.post('/issue', controller.issueNotification);
router.post('/clean', controller.cleanNotifications);
router.post('/like', controller.like);
router.post('/comment', controller.comment);
module.exports = router;
