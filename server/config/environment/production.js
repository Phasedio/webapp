'use strict';

// Production specific configuration
// =================================
module.exports = {
  // Server IP
  ip:       process.env.OPENSHIFT_NODEJS_IP ||
            process.env.IP ||
            undefined,

  // Server port
  port:     process.env.OPENSHIFT_NODEJS_PORT ||
            process.env.PORT ||
            8080,

  // MongoDB connection options
  // mongo: {
  //   uri:    process.env.MONGOLAB_URI ||
  //           process.env.MONGOHQ_URL ||
  //           process.env.OPENSHIFT_MONGODB_DB_URL+process.env.OPENSHIFT_APP_NAME ||
  //           'mongodb://localhost/webapp'
  // },
  mongo: {
    uri: 'mongodb://webapp:lordofwolves@ds025469.mlab.com:25469/heroku_nmqv1jnf/'
  },

  // mongo session store
  mongoStoreConnectionString : 'mongodb://webapp:lordofwolves@ds025469.mlab.com:25469/heroku_nmqv1jnf/phased-session-store', // our db on mLabs

  // firebase secrets
  FB_SECRET_1 : '0ezGAN4NOlR9NxVR5p2P1SQvSN4c4hUStlxdnohh',
  FB_SECRET_2 : 'A50wFi5OxaLYNzb4jnEyFMQWmE8mjRyWJCKW723g',

  // google auth vars
  google : {
  	CLIENT_ID : '313573711545-p9bo68ve6d5oih51datnkv1i8vrumipq.apps.googleusercontent.com',
  	CLIENT_SECRET : 'vanRqrxMPnlZ2qNpEp4bwDTW',
  	REDIRECT_URL : 'https://phased.io/api/google/auth2',
  	CALENDAR_EVENTS_WEBHOOK_URL: 'https://phased.io/hooks/google/events'
  },
  slack : {
  	CLIENT_ID : '9715671828.29433898465',
  	CLIENT_SECRET : '77413729efd3d554430fa6c123a157cc',
  	REDIRECT_URL : 'https://phased.io/api/slack/auth' //nb: this has to be changed in the slack contol panel to match...
  }
};
