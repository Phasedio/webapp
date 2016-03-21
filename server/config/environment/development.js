'use strict';

// Development specific configuration
// ==================================
module.exports = {
  // MongoDB connection options
  mongo: {
    uri: 'mongodb://localhost/webapp-dev'
  },
  
  // firebase secrets
  FB_SECRET_1 : '0ezGAN4NOlR9NxVR5p2P1SQvSN4c4hUStlxdnohh',
  FB_SECRET_2 : 'A50wFi5OxaLYNzb4jnEyFMQWmE8mjRyWJCKW723g',

  // google auth vars
  google : {
  	CLIENT_ID : '313573711545-p9bo68ve6d5oih51datnkv1i8vrumipq.apps.googleusercontent.com',
  	CLIENT_SECRET : 'vanRqrxMPnlZ2qNpEp4bwDTW',
  	REDIRECT_URL : 'https://81a3e00e.ngrok.io/api/google/auth2',
  	CALENDAR_EVENTS_WEBHOOK_URL: 'https://81a3e00e.ngrok.io/api/hooks/google/events/'
  },

  seedDB: true
};
