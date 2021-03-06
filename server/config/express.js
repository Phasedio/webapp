/**
 * Express configuration
 */

'use strict';

var express = require('express');
//var favicon = require('serve-favicon');
var morgan = require('morgan');
var compression = require('compression');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var cookieParser = require('cookie-parser');
var errorHandler = require('errorhandler');
var path = require('path');
var config = require('./environment');
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);
var FirebaseStore = require('connect-firebase')(session);
var expressJWT = require('express-jwt');
var unless = require('express-unless');
expressJWT.unless = unless;


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

  // configure JWT auth parsing
  // for strategy below, see https://jwt.io/introduction/ and https://github.com/auth0/express-jwt
  // same except FB makes our JWTs using the secret specified below
  app.use(expressJWT({
  	secret : config.FB_SECRET_1, // firebase secret, means we can trust parsed data from JWT
  	getToken: function onlyHeader (req) {
  		if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
  			return req.headers.authorization.split(' ')[1];
  		}
  		return null;
  	}
  }).unless(function(req) {
  	// allow non-API GET requests
  	var allow = (req.method == 'GET' && req.path.indexOf('/api/') < 0);

  	// allow a whitelist of otherwise blocked requests
  	var whiteList = config.authURLWhiteList;
  	for (var i in whiteList) {
  		if (req.path.indexOf(whiteList[i]) >= 0)
  			allow = true;
  	}

  	return allow;
  }));

  app.use(function (err, req, res, next) {
  	if (err.name === 'UnauthorizedError' && req.originalUrl.indexOf('logout') == -1) {
  		console.log('Unauthorized request to ' + req.originalUrl);
  		res.status(401).send(err.name + ': ' + err.message);
  		return;
  	}
  	next();
  });

  // configure prod and dev services

  /*
  ** PROD OR TESTING SESSIONS
  */
  if ('production' === env || 'test' === env) {
  	// configure session
	  // see https://github.com/expressjs/session
	  var expressSessionOpts = {
	  	name : 'phased.sid', // name for SID cookie
	  	store: new MongoStore({ url : config.mongoStoreConnectionString }), // more options at https://www.npmjs.com/package/connect-mongo
	  	secret : '331c3b825824c749abc01bf3', // signs session ID cookie
	  	resave : false, // whether to resave if data hasn't changed. could create race condition.
	  	saveUninitialized : false // not sure if this should be false or true.
	  };
	  app.use(session(expressSessionOpts));
  }

  /*
  ** PROD
  */
  if ('production' === env) {
    //app.use(favicon(path.join(config.root, 'client', 'favicon.ico')));
    app.use(express.static(path.join(config.root, 'public')));
    app.set('appPath', path.join(config.root, 'public'));
    app.use(morgan('dev'));
  }

  /*
  ** DEV
  */
  if ('development' === env || 'test' === env) {
    app.use(require('connect-livereload')());
    app.use(express.static(path.join(config.root, '.tmp')));
    app.use(express.static(path.join(config.root, 'client')));
    app.set('appPath', path.join(config.root, 'client'));
    app.use(morgan('dev'));
    app.use(errorHandler()); // Error handler - has to be last
  }
};
