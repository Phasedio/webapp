'use strict';

var _ = require('lodash');
var config = require('../../config/environment');
var FBRef = require('../../components/phasedFBRef').getRef();
var stripe = require('stripe')('sk_live_nKZ1ouWkI3WuiVGK2hIvZUH1');
//var stripe = require('stripe')('sk_test_XCwuQhHhSTCGrbXl12ubBE8Y');


// Get list of pays
exports.index = function(req, res) {
	res.json([]);
};

exports.create = function(req, res) {
	var team = req.body.team;
	var cc = req.body.token;
	//var amount = req.body.amount;

	var badStrings = [".", "#", "$", "[", "]"];
	for (var i in badStrings) {
		if (team.indexOf(badStrings[i]) >= 0) {
			res.status(400).end(); // bad request
		}
	}

	FBRef.child('team').child(team).child('billing').once('value', function(snap) {
		var s = snap.val();
		if (s) {
			stripe.customers.update(s.stripeid, {
				source: cc
			}, function(err, customer) {
				// asynchronously called
				if (err) {
					console.log(err);
					res.send({
						success: false,
						customer: 'ad'
					});
				} else {
					res.send({
						success: true,
						customer: 'ad'
					});
				}
			});
		}
	});
};

exports.find = function(req, res) {
	var user = req.body.customer;
	var sub = req.body.sub;

	if (!user || !sub || user.length < 1 || sub.length < 1) {
		res.status(400).end(); // bad request
	}

	stripe.customers.retrieveSubscription(
		user,
		sub,
		function(err, subscription) {
			// asynchronously called
			if (err) {
				if (err.statusCode == 404) {
					res.send({
						status: 'canceled'
					});
				} else {
					res.send({
						err: err
					});
				}

			} else {
				if (subscription) {
					res.send({
						status: subscription.status
					});
				} else {
					res.send({
						err: 'no subs'
					});
				}
			}
		}
	);
	// stripe.customers.retrieve(
	//   user,
	//   function(err, customer) {
	//     // asynchronously called
	//     if (err){
	//     	res.send({err:err});
	//     }else{
	//     	if(customer.subscriptions.data[0]){
	//     		res.send({status:customer.subscriptions.data[0].status});
	//     	}else{
	//     		res.send({err:'no subs'});
	//     	}
	//
	//     }
	//
	//   }
	// );
};

exports.expired = function(req, res) {

	var team = req.body.team;
	var cc = req.body.token;


	FBRef.child('team').child(team).child('billing').once('value', function(snap) {
		var s = snap.val();
		if (s) {

			//First check if accunt is really unpaid
			stripe.customers.retrieve(
				s.stripeid,
				function(err, customer) {
					// asynchronously called
					if (err) {
						res.send({
							success: false,
							short: 'customer',
							err: err
						});

					} else {
						if (customer.subscriptions.data[0]) {

							if (customer.subscriptions.data == "active") {
								res.send({
									status: customer.subscriptions.data[0].status
								});
								return
							} else {
								updateCardAndChargeLastInvoice(s.stripeid, cc, res);
							}

						} else {
							res.send({
								success: false,
								short: 'subs',
								err: 'no subs'
							});
						}

					}
				}
			);
		}
	});

	function updateCardAndChargeLastInvoice(id, creditCard, respond) {
		var stripeid = id;
		var cc = creditCard;
		var res = respond;
		// Update customer id with new payment option
		stripe.customers.update(stripeid, {
			source: cc
		}, function(err, customer) {
			// asynchronously called
			if (err) {
				console.log(err);
				res.send({
					success: false,
					short: 'card',
					customer: err
				});
				return;
			} else {
				// On success, Get all invoices for this customer
				stripe.invoices.list({
						customer: stripeid,
						limit: 3
					},
					function(err, invoices) {
						// Pay invoice.
						if (err) {
							res.send({
								success: false,
								short: 'list',
								customer: err
							});
							return;
						} else {
							stripe.invoices.pay(invoices.data[0].id, function(err, invoice) {
								if (err) {
									//Card didn't go through
									if (err.message == "Invoice is already paid") {
										res.send({
											success: true,
											customer: err
										});
										return;
									} else {
										res.send({
											success: false,
											customer: err
										});
										return;
									}
								} else {
									//yay money.
									res.send({
										success: true,
										customer: 'ad'
									});
									return;
								}
							});
						}
					}
				);
			}
		});
	}
};

exports.cancel = function(req, res) {
	/*
	Cancel plan on stripe
	Set team for manual deletion
	return success and unauth the user
	*/
	console.log('Canceling team');
	var team = req.body.team;
	var user = req.body.user;
	var billing = {};
	//Remove from Stripe
	FBRef.child('team').child(team).child('members').child(user).once('value', function(snap) {
		var s = snap.val();
		if (s) {
			//if true then get the stripe token and find the sub.
			if (s.role == 2) {
				console.log('Canceling team');
				//Remove team from member profiles
				FBRef.child('team').child(team).child('members').once('value', function(snap) {
					snap.forEach(function(childSnapshot) {
						// key will be "fred" the first time and "barney" the second time
						var key = childSnapshot.key();
						console.log(key);
						FBRef.child('profile').child(key).child('teams').orderByValue().equalTo(team).limitToFirst(1).once('value', function(snap) {
							var memberRef = snap.val();
							var teamKey = Object.keys(memberRef);
							FBRef.child('profile').child(key).child('teams').child(teamKey[0]).remove();
							console.log(memberRef);
						});
					});
				});
				console.log('Canceling team');
				FBRef.child('team').child(team).child('billing').once('value', function(shot) {
					shot = shot.val();
					if (shot) {
						billing = shot;
						//Find sub
						stripe.customers.retrieve(
							billing.stripeid,
							function(err, customer) {
								// asynchronously called
								if (err) {
									console.log(err);
									res.send({
										err: err
									});
								} else {
									if (customer.subscriptions.data[0]) {
										//Cancel the sub
										stripe.customers.cancelSubscription(
											billing.stripeid,
											customer.subscriptions.data[0].id,
											function(err, confirmation) {
												// asynchronously called
												if (err) {
													console.log(err);
													res.send({
														err: 'no subs'
													});
												} else {
													//Sub is now canceled.
													//Remove team from members.
													res.send({
														message: confirmation
													});

												}
											}
										);

									} else {
										res.send({
											err: 'no subs'
										});
									}

								}
							}
						);
					}
				});
			}
			//res.send({err:'Not high enough priv'});
		}
	});
	//res.send('done');
	// cancel sub.
};
