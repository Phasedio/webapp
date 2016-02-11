'use strict';

angular.module('webappApp')
  .controller('TeamExpiredCtrl', function ($scope, $http, stripe, Auth, FURL,Phased,$location) {
    $scope.message = 'Hello';
    console.log(Phased);
    $scope.ccSubmited = false;

    $scope.charge = function (card) {
      if($scope.ccForm.$valid){
        $scope.ccSubmited = true;
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
          return $http.post('./api/pays/expired', payment);
        })
        .then(function (payment) {
        	console.log(payment.data);
          var p = payment.data;
          if(p.success){
            //send back to app.
            $location.path("/");
          }else{
            $scope.ccSubmited = false;
            alert("error!\n"+p.customer.message+"\n Please contact support if you need help!");
          }

        })
        .catch(function (err) {
          if (err.type && /^Stripe/.test(err.type)) {
            $scope.ccSubmited = false;
            alert("error!\n"+err.message+"\n Please contact support if you need help!");
            console.log('Stripe error: ', err.message);
          }
          else {
            $scope.ccSubmited = false;
            alert("error!\n"+err.message+"\n Please contact support if you need help!");
            
            console.log('Other error occurred, possibly with your API', err.message);
          }
        });

      }else{
        if($scope.ccForm.$error.required){
          alert("please fill in the highlighted inputs");
        }
        console.log($scope.ccForm.$error);
      }

    };
  });
