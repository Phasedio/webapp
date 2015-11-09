'use strict';

angular.module('webappApp')
  .controller('BillingCtrl', function ($scope, $http, stripe, Auth, FURL) {
    var ref = new Firebase(FURL);
    $scope.user = '';
    $scope.currentTeam = {};
    $scope.viewType = '';
    $scope.billinInfo = {};
  	$scope.payment = {
  		card: {}
  	};

    /**
    * charge 
    */
    $scope.charge = function (card) {
    	console.log(card);
     	$scope.payment.card = card;
    return stripe.card.createToken($scope.payment.card)
      .then(function (token) {
        console.log('token created for card ending in ', token.card.last4);
        var payment = angular.copy($scope.payment);
        payment.card = void 0;
        payment.token = token.id;
        payment.email = $scope.email;
        payment.team = $scope.team;
        payment.amount = $scope.currentTeam.length;
        return $http.post('./api/pays', payment);
      })
      .then(function (payment) {
      	console.log(payment.data);
        var obj = {
          stripeid : payment.data.customer,
          email : $scope.email,
          plan : 'basic'
        }
        ref.child('team').child($scope.team).child('billing').set(obj);
        ref.child('team').child($scope.team).child('plan').set('basic');
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
  $scope.checkPlanStatus = function(teamData){
    console.log('wohohohohoo');
    var team = teamData;
    console.log(team);
    if(team.billing){
      $scope.billinInfo = team.billing;
      console.log('wohohohohoo');
      $http.post('./api/pays/find',{customer:team.billing.stripeid}).success(function(data){
        console.log(data);
        if(data.err){
          console.log(data.err);
        }
        if(data.status == "active"){
          //Show thing for active
          $scope.viewType = 'active';

        }else if(data.status == 'past_due' || data.status == 'unpaid'){
          //Show thing for problem with account
          $scope.viewType = 'problem';
        }else if(data.status == 'canceled'){
          //Show thing for problem with canceled
          $scope.viewType = 'notPaid';
        }
        console.log($scope.viewType);
        //$scope.$apply();
      }).error(function(data){
        console.log(data);
      });
    }else{
      $scope.viewType = 'notPaid';
      $scope.$apply();
    }
  }

  $scope.init = function(){
    ref.child('profile').child(Auth.user.uid).once('value',function(data){
      data = data.val()
      $scope.user = data.name;
      $scope.email = data.email;
      $scope.team = data.curTeam;
      ref.child('team').child(data.curTeam).once('value',function(data){
        data = data.val();
        console.log(data);
        
        $scope.currentTeam = Object.keys(data.task);
        console.log($scope.currentTeam);
        
        $scope.checkPlanStatus(data);
      });
      
    });


  }


  $scope.init();

  });
