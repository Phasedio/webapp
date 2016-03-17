/**
 * Main application routes
 */

'use strict';

var errors = require('./components/errors');
var path = require('path');

module.exports = function(app) {
	// save authenticated user to session if present
	// use with req.session.user.uid
	// NB: This is from the FB JWT, and so could be a mapped
	// 			user from another provider. req.session.user.provider
	//			will be set to the provider name.
	app.use(function(req, res, next) {
		if (req.method == "POST" && req.user) {
			if (!('user' in req.session))
				console.log('session started');
			else if (req.session.user.uid != req.user.d.uid)
				console.log('session user changed');
			
			req.session.user = req.user.d;
		}
		next();
	});

  // Insert routes below
  app.use('/api/downloads', require('./api/download'));
  app.use('/api/pays', require('./api/pay'));
  app.use('/api/things', require('./api/thing'));
  app.use('/api/registration', require('./api/registration'));
  app.use('/api/hooks/github', require('./api/hooks/github'));

  // generous api endpoint spellings
  app.use('/api/notification', require('./api/notification'));
  app.use('/api/notifications', require('./api/notification'));
  app.use('/api/notif', require('./api/notification'));
  app.use('/api/notifs', require('./api/notification'));

  app.use('/api/googleAuth', require('./api/googleAuth'));

  app.use('/api/setup', require('./api/setup'));
  
  // All undefined asset or api routes should return a 404
  app.route('/:url(api|auth|components|app|bower_components|assets)/*')
   .get(errors[404]);

  // special admin routing
  app.route('/admin')
    .get(function(req, res){
      // deny request politely here if user is not logged in
      // ...how do we get the user?
      res.sendFile(path.resolve(app.get('appPath') + '/index.html'));
    });

  // special logout routing to start or destroy session
  // start
  app.route(/\/(ping|touch)/).post(function(req, res){
  	res.status(200).end();
  });
  // destroy
  app.route('/logout')
  	.get(function(req, res){
  		req.session.destroy();
  		res.sendFile(path.resolve(app.get('appPath') + '/index.html'));
  	})
  	.post(function(req, res){
  		req.session.destroy();
  		res.status(200).end();
  	});

  // All other routes should redirect to the index.html
  app.route('/*')
    .get(function(req, res) {
      res.sendFile(path.resolve(app.get('appPath') + '/index.html'));
    });
};
