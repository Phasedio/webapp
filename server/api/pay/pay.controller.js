'use strict';

var _ = require('lodash');
var stripe = require('stripe')('sk_test_XCwuQhHhSTCGrbXl12ubBE8Y');


// Get list of pays
exports.index = function(req, res) {
  res.json([]);
};

exports.create = function(req, res) {
	var amount = req.body.amount;
	stripe.customers.create({
	  description: 'Pays for team: ' + req.body.team,
	  email : req.body.email,
	  source: req.body.token // obtained with Stripe.js
	}, function(err, customer) {
	  // asynchronously called
	  if (err) {
		     // bad things
		        console.log(err);
		        res.send({err:err});
	  } else {
		    // successful charge
		     console.log(customer.id);
		     stripe.customers.createSubscription(
		     	customer.id,
		     	{
		     		plan: 'basic',
		     		quantity : amount
		     	},
		     	function(err, sub){
		     		if(err){
		     			console.log(err);
		     			res.send({err:err});
		     		}
		     		else{
		     			console.log(sub);
		     			res.send({success:true, customer : customer.id});
		     		}
		     	}
		     	)
		 }
	});
	console.log(req.body);
  	
};
exports.find = function(req, res) {
	var user = req.body.customer;
  stripe.customers.retrieve(
	  user,
	  function(err, customer) {
	    // asynchronously called
	    if (err){
	    	res.send({err:err});
	    }else{
	    	if(customer.subscriptions.data[0]){
	    		res.send({status:customer.subscriptions.data[0].status});
	    	}else{
	    		res.send({err:'no subs'});
	    	}

	    }

	  }
	);
};