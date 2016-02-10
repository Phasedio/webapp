'use strict';

var _ = require('lodash');
var Firebase = require("firebase");
var FirebaseTokenGenerator = require("firebase-token-generator");

var FBRef = new Firebase("https://phased-dev2.firebaseio.com/");
var tokenGenerator = new FirebaseTokenGenerator("igwdoQvGJzn0LXBPKWmn5RllwVZSFqIOo3JLeBm0");
var token = tokenGenerator.createToken({uid: "registration-server",isReg: true });
var stripe = require('stripe')('sk_test_XCwuQhHhSTCGrbXl12ubBE8Y');


// Get list of pays
exports.index = function(req, res) {
  res.json([]);
};

exports.create = function(req, res) {
	var team = req.body.team;
  var cc = req.body.token;
  //var amount = req.body.amount;
  console.log(team,token);
  FBRef.authWithCustomToken(token, function(error, authData) {
    if (error) {
      res.send(error);
      return;
    }

    FBRef.child('team').child(team).child('billing').once('value',function(snap){
      var s = snap.val();
      if (s){
        stripe.customers.update(s.stripeid, {
          source: cc
        }, function(err, customer) {
          // asynchronously called
          if(err){
            console.log(err);
            res.send({success:false, customer : 'ad'});
          }else{
            res.send({success:true, customer : 'ad'});
          }
        });
      }
    });

  });


  //   stripe.customers.update("cus_7s8iu7vv2w0OkR", {
  //   description: "Customer for test@example.com"
  // }, function(err, customer) {
  //   // asynchronously called
  // });


	// stripe.customers.create({
	//   description: 'Pays for team: ' + req.body.team,
	//   email : req.body.email,
	//   source: req.body.token // obtained with Stripe.js
	// }, function(err, customer) {
	//   // asynchronously called
	//   if (err) {
	// 	     // bad things
	// 	        console.log(err);
	// 	        res.send({err:err});
	//   } else {
	// 	    // successful charge
	// 	     console.log(customer.id);
	// 	     stripe.customers.createSubscription(
	// 	     	customer.id,
	// 	     	{
	// 	     		plan: 'basic',
	// 	     		quantity : amount
	// 	     	},
	// 	     	function(err, sub){
	// 	     		if(err){
	// 	     			console.log(err);
	// 	     			res.send({err:err});
	// 	     		}
	// 	     		else{
	// 	     			console.log(sub);
	// 	     			res.send({success:true, customer : customer.id});
	// 	     		}
	// 	     	}
	// 	     	)
	// 	 }
	// });
	// console.log(req.body);

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

exports.expired = function(req, res) {

  var team = req.body.team;
  var cc = req.body.token;

  FBRef.authWithCustomToken(token, function(error, authData) {
    if (error) {
      res.send(error);
      return;
    }

    FBRef.child('team').child(team).child('billing').once('value',function(snap){
      var s = snap.val();
      if (s) {

        //First check if accunt is really unpaid
        stripe.customers.retrieve(
      	  s.stripeid,
      	  function(err, customer) {
      	    // asynchronously called
      	    if (err){
      	    	res.send({success:false,short:'customer',err:err});

      	    }else{
      	    	if(customer.subscriptions.data[0]){

                if (customer.subscriptions.data == "active") {
                  res.send({status:customer.subscriptions.data[0].status});
                  return
                }else{
                  updateCardAndChargeLastInvoice(s.stripeid,cc,res);
                }

      	    	}else{
      	    		res.send({success:false,short:'subs',err:'no subs'});
      	    	}

      	    }

      	  }
      	);

      }
    });
  });




    function updateCardAndChargeLastInvoice(id,creditCard,respond){
      var stripeid = id;
      var cc = creditCard;
      var res = respond;
      // Update customer id with new payment option
      stripe.customers.update(stripeid, {
        source: cc
      }, function(err, customer) {
        // asynchronously called
        if(err){
          console.log(err);
          res.send({success:false,short:'card', customer : err});
          return;
        }else{
          // On success, Get all invoices for this customer
          stripe.invoices.list(
            { customer: stripeid,limit: 3 },
            function(err, invoices) {
              // Pay invoice.
              if (err) {
                res.send({success:false,short:'list', customer : err});
                return;
              }else{
                stripe.invoices.pay(invoices.data[0].id, function(err, invoice) {
                  if(err){
                    //Card didn't go through
                    if(err.message == "Invoice is already paid"){
                      res.send({success:true, customer : err});
                      return;
                    }else{
                      res.send({success:false, customer : err});
                      return;
                    }

                  }else{
                    //yay money.
                    res.send({success:true, customer : 'ad'});
                    return;
                  }
                });
              }

            }
          );
        }
      });
    }

}
