/**
 * Express configuration
 */

'use strict';

var express = require('express');
var favicon = require('serve-favicon');
var morgan = require('morgan');
var compression = require('compression');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var cookieParser = require('cookie-parser');
var errorHandler = require('errorhandler');
var path = require('path');
var config = require('./environment');
var session = require('express-session');
var FirebaseStore = require('connect-firebase')(session);


module.exports = function(app) {
  var env = app.get('env');

  app.set('views', config.root + '/server/views');
  app.engine('html', require('ejs').renderFile);
  app.set('view engine', 'html');
  app.use(compression());
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json({limit: '900kb'}));
  app.use(bodyParser.json());
  app.use(methodOverride());
  app.use(cookieParser());

  // configure sessions
  // see https://github.com/ca98am79/connect-firebase
  var FBStoreOpts = {
  	host : 	'phased-dev2.firebaseio.com',
  	token : 'A50wFi5OxaLYNzb4jnEyFMQWmE8mjRyWJCKW723g',
  	reapInterval : env === 'development' ? 300000 : 21600000 // session cleanup interval in ms (default is 6hrs = 21600000ms, dev is 5min)
  };
  // see https://github.com/expressjs/session
  var expressSessionOpts = {
  	name : 'phased.sid', // name for SID cookie
  	store: new FirebaseStore(FBStoreOpts),
  	secret : '331c3b825824c749abc01bf3', // signs session ID cookie
  	resave : false, // whether to resave if data hasn't changed. could create race condition.
  	saveUninitialized : false // not sure if this should be false or true.
  };
  app.use(session(expressSessionOpts));

  if ('production' === env) {
    app.use(favicon(path.join(config.root, 'public', 'favicon.ico')));
    app.use(express.static(path.join(config.root, 'public')));
    app.set('appPath', path.join(config.root, 'public'));
    app.use(morgan('dev'));
  }

  if ('development' === env || 'test' === env) {
    app.use(require('connect-livereload')());
    app.use(express.static(path.join(config.root, '.tmp')));
    app.use(express.static(path.join(config.root, 'client')));
    app.set('appPath', path.join(config.root, 'client'));
    app.use(morgan('dev'));
    app.use(errorHandler()); // Error handler - has to be last
  }
};
