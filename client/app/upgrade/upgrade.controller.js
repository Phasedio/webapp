'use strict';

angular.module('webappApp')
  .controller('UpgradeCtrl', function ($scope, stripe, $http, Auth, FURL,Phased,$location) {
    $scope.message = 'Hello';
    $scope.ccShow = false;

    $scope.$on('Phased:setup', function() {
      $scope.team = Phased._membersRetrieved;
    });



    /**
    * charge
    */
    $scope.charge = function (card) {
    	console.log(card);
     	var c = card;
      return stripe.card.createToken(c)
        .then(function (token) {
          console.log('token created for card ending in ', token.card.last4);
          var payment = {};
          payment.card = void 0;
          payment.token = token.id;
          payment.email = Phased.user.email;
          payment.team = Phased.team.uid;
          return $http.post('./api/pays', payment);
        })
        .then(function (payment) {
        	console.log(payment.data);
          // var obj = {
          //   stripeid : payment.data.customer,
          //   email : $scope.email,
          //   plan : 'basic'
          // }
          // ref.child('team').child($scope.team).child('billing').set(obj);
          // ref.child('team').child($scope.team).child('plan').set('basic');
          //console.log('successfully submitted payment for $', payment.amount);
        })
        .catch(function (err) {
          if (err.type && /^Stripe/.test(err.type)) {
            console.log('Stripe error: ', err.message);
          }
          else {
            console.log('Other error occurred, possibly with your API', err.message);
          }
        });
    };


  });
