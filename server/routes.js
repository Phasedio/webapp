/**
 * Main application routes
 */

'use strict';

var errors = require('./components/errors');
var path = require('path');

module.exports = function(app) {

  // Insert routes below
  app.use('/api/downloads', require('./api/download'));
  app.use('/api/pays', require('./api/pay'));
  app.use('/api/things', require('./api/thing'));
  app.use('/api/auth', require('./api/auth'));
  
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

  // All other routes should redirect to the index.html
  app.route('/*')
    .get(function(req, res) {
      res.sendFile(path.resolve(app.get('appPath') + '/index.html'));
    });
};
