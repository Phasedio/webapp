'use strict';

angular.module('webappApp')
  .controller('BillingCtrl', function ($scope, $http, stripe, Auth, FURL) {
    var ref = new Firebase(FURL);
    $scope.user = '';
    $scope.currentTeam = {};
  	$scope.payment = {
  		card: {}
  	};

    /**
    * charge 
    */
    $scope.charge = function (card) {
    	console.log(card);
     	$scope.payment.card = card;
     	$scope.payment.amount = 20000000;
    return stripe.card.createToken($scope.payment.card)
      .then(function (token) {
        console.log('token created for card ending in ', token.card.last4);
        var payment = angular.copy($scope.payment);
        payment.card = void 0;
        payment.token = token.id;
        return $http.post('./api/pays', payment);
      })
      .then(function (payment) {
      	console.log(payment.data);
        console.log('successfully submitted payment for $', payment.amount);
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

  $scope.init = function(){
    ref.child('profile').child(Auth.user.uid).once('value',function(data){
      data = data.val()
      $scope.user = data.name;
      ref.child('team').child(data.curTeam).once('value',function(data){
        data = data.val();
        console.log(data);
        $scope.currentTeam = Object.keys(data.task);
        console.log($scope.currentTeam);
        $scope.$apply();
      });
      $scope.$apply();
    });


  }


  $scope.init();

  });
