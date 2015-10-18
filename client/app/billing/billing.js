'use strict';

angular.module('webappApp')
  .config(function ($routeProvider) {
    $routeProvider
      .when('/billing', {
        templateUrl: 'app/billing/billing.html',
        controller: 'BillingCtrl'
      });
  });
