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
  FB_SECRET_2 : 'A50wFi5OxaLYNzb4jnEyFMQWmE8mjRyWJCKW723g'
};