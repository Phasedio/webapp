/**
 * Main application file
 */

'use strict';

// Set default node environment to development
// process.env.NODE_ENV = process.env.NODE_ENV || 'test'; // for testing sessions, webhooks, & api routes
process.env.NODE_ENV = 'development';
//process.env.NODE_ENV = process.env.NODE_ENV || 'production';


//test
var express = require('express');
var config = require('./config/environment');
// Setup server
var app = express();
var http = require('http');
var server = http.createServer(app);
require('./config/express')(app);
require('./routes')(app);
require('./components/phased').init(); // set up phased abstractions
if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test')
	require('./components/gcal').init(); // start google calendar scheduled statuses


// Start server
server.listen(config.port, config.ip, function () {
  console.log('Express server listening on %d, in %s mode', config.port, app.get('env'));
});

// Expose app
exports = module.exports = app;
