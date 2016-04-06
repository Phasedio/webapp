'use strict';

angular.module('webappApp')
  .controller('BillingCtrl', function ($scope,stripe, $http, Auth, FURL,Phased,$location) {


    //Stripe.setPublishableKey('pk_test_6pRNASCoBOKtIshFeQd4XMUh');
    ga('send', 'pageview', '/billing');
    var ref = new Firebase(FURL);
    $scope.Phased = Phased;
    $scope.ccSubmited = false;
    console.log(Phased);
    // $scope.currentTeam = {};
    // $scope.viewType = '';
    // $scope.billinInfo = {};
  	// $scope.payment = {
  	// 	card: {}d
  	// };

    // bounce users without Admin or Owner permissions
    Phased.maybeBounceUser();


    $scope.removeTeam = function () {
      //ref.child('deletedTeams').push({team:"hi"});
      var p = {
        team : Phased.team.uid,
        user : Phased.user.uid
      };
      console.log( 'sending');
      $http.post('./api/pays/cancel', p).then(function(data){
        console.log( data);
      });
    };
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

  // $scope.init = function(){
  //   ref.child('profile').child(Auth.user.uid).once('value',function(data){
  //     data = data.val()
  //     $scope.user = data.name;
  //     $scope.email = data.email;
  //     $scope.team = data.curTeam;
  //     ref.child('team').child(data.curTeam).once('value',function(data){
  //       data = data.val();
  //       console.log(data);
  //
  //       $scope.currentTeam = Object.keys(data.task);
  //       console.log($scope.currentTeam);
  //
  //       $scope.checkPlanStatus(data);
  //     });
  //
  //   });
  //
  //
  // }


  //$scope.init();

  });
