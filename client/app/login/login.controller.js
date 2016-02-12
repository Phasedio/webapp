'use strict';

angular.module('webappApp')
  .controller('LoginCtrl', function ($scope, Auth, $location, FURL) {
    ga('send', 'pageview', '/login');
    var ref = new Firebase(FURL);

    $scope.forms = "login";
    $scope.signInSubmited = false;//for spinners
    $scope.regSubmited = false;//for spinners

    // attempt to login a user
    $scope.loginUser = function(user) {
      if($scope.userForm.$valid){
        $scope.signInSubmited = true;
        ga('send', 'event', 'Login', 'Login User');
        Auth.login(user, function() {}, function(err){
          console.log(err);
          alert(err);
        });
      }else {
        if($scope.userForm.$error.required){
          alert("please fill in the highlighted inputs");
        }

      }

    }

    // register a new user
    $scope.regUser = function(user){
      // console.log('will show new modal here');
      Auth.register(user)
      ga('send', 'event', 'Register', 'new user');
    }

    // show create account form
    $scope.showRegisterForm = function(){
      ga('send', 'event', 'Register', 'Show form');
      $scope.forms = "reg";
    }

    // show login form
    $scope.showLoginForm = function(){
      ga('send', 'event', 'Login', 'Show form');
      $scope.forms = "login";
    };

    // attempts to send reset password email
    $scope.forgotPassword = function(email){
      if($scope.regForm.$valid){
      $scope.regSubmited = true;
      // console.log("will send email to :", email);
      ref.resetPassword({
        email : email
      }, function(error) {
        if (error === null) {
          ga('send', 'event', 'Forgot Passord', 'Sent email');
          alert('Instructions send to your email!');
          // console.log("Password reset email sent successfully");
        } else {
          alert('Error! The email you entered in the form appears to have an issue. Please contact support');
          // console.log("Error sending password reset email:", error);
        }
      });
    }else{
      if($scope.regForm.$error.required){
        alert("please fill in the highlighted inputs");
      }
    }
  }



});
