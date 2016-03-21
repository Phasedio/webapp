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
  mongo: {
    uri:    process.env.MONGOLAB_URI ||
            process.env.MONGOHQ_URL ||
            process.env.OPENSHIFT_MONGODB_DB_URL+process.env.OPENSHIFT_APP_NAME ||
            'mongodb://localhost/webapp'
  },

  // firebase secrets
  FB_SECRET_1 : '0ezGAN4NOlR9NxVR5p2P1SQvSN4c4hUStlxdnohh',
  FB_SECRET_2 : 'A50wFi5OxaLYNzb4jnEyFMQWmE8mjRyWJCKW723g',

  // google auth vars
  google : {
  	CLIENT_ID : '313573711545-p9bo68ve6d5oih51datnkv1i8vrumipq.apps.googleusercontent.com',
  	CLIENT_SECRET : 'vanRqrxMPnlZ2qNpEp4bwDTW',
  	REDIRECT_URL : 'https://phased.io/api/google/auth2',
  	CALENDAR_EVENTS_WEBHOOK_URL: 'https://phased.io/hooks/google/events'
  }
};