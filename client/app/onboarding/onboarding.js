'use strict';

angular.module('webappApp')
  .config(function ($routeProvider) {
    $routeProvider
      .when('/onboarding', {
        templateUrl: 'app/onboarding/onboarding.html',
        controller: 'OnboardingCtrl'
      });
  });
