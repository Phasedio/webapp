'use strict';

angular.module('webappApp')
  .controller('LoginCtrl', function ($scope, Auth, $location, FURL) {
    ga('send', 'pageview', '/login');
    var ref = new Firebase(FURL);

    $scope.forms = "login";

    // attempt to login a user
    $scope.loginUser = function(user) {
      ga('send', 'event', 'Login', 'Login User');
      Auth.login(user, function() {}, function(err){
        console.dir(err);
        alert(err);
      });
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
      // console.log("will send email to :", email);
      ref.resetPassword({
        email : email
      }, function(error) {
        if (error === null) {
          ga('send', 'event', 'Forgot Passord', 'Sent email');
          // console.log("Password reset email sent successfully");
        } else {
          // console.log("Error sending password reset email:", error);
        }
      });
  }



});
