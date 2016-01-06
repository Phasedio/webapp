'use strict';

angular.module('webappApp', [
  'ngCookies',
  'ngResource',
  'ngSanitize',
  'ngRoute',
  'ui.bootstrap',
  'ui.calendar',
  'angular-stripe',
  'credit-cards',
  'firebase',
  'angularMoment',
  'ngAnimate',
  'toaster'
])
.config(function (stripeProvider) {
    stripeProvider.setPublishableKey('pk_test_WFDUVuvY0pcVHTnquFTLvTSX');
  })
.constant('FURL', 'https://phaseddev.firebaseio.com/')
.run(['$rootScope', '$location', function ($rootScope, $location) {
        $rootScope.$on("$routeChangeError", function(event, next, previous, error) {
          // We can catch the error thrown when the $requireAuth promise is rejected
          // and redirect the user back to the home page
          if (error === "AUTH_REQUIRED") {
            $location.path("/login");
          }
        });
    }])

  .config(function ($routeProvider, $locationProvider) {
    $routeProvider
      .otherwise({
        redirectTo: '/'
      });

    $locationProvider.html5Mode(true);
  });
