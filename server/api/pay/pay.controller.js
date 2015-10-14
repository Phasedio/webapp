'use strict';

var _ = require('lodash');
var stripe = require('stripe')('sk_test_XCwuQhHhSTCGrbXl12ubBE8Y');


// Get list of pays
exports.index = function(req, res) {
  res.json([]);
};

exports.create = function(req, res) {

	stripe.customers.create({
	  description: 'Customer for test@example.com',
	  email : 'brian@phased.io',
	  source: req.body.token // obtained with Stripe.js
	}, function(err, customer) {
	  // asynchronously called
	  if (err) {
		     // bad things
		        console.log(err);
	  } else {
		    // successful charge
		     console.log(customer.id);
		     stripe.customers.createSubscription(
		     	customer.id,
		     	{
		     		plan: 'basic',
		     		quantity : 5
		     	},
		     	function(err, sub){
		     		if(err){
		     			console.log(err);
		     		}
		     		else{
		     			console.log(sub);
		     		}
		     	}
		     	)
		 }
	});
	console.log(req.body);
  	res.send(req.body);
};