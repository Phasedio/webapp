'use strict';

// first thing: remove .no-js from html
var rootEl = document.getElementsByTagName('html')[0];
rootEl.className = rootEl.className.split('no-js').join('');

angular.module('webappApp', [
  'ngCookies',
  'ngResource',
  'ngSanitize',
  'ngRoute',
  'ui.bootstrap',
  'ui.calendar',
  // 'angular-stripe',
  'credit-cards',
  'firebase',
  'angularMoment',
  'ngAnimate',
  'toaster',
  'angular-inview'
])
.config(function () {
    //stripeProvider.setPublishableKey('pk_live_FPvARdIWeOzOfW8TGqtFd9QN');
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

      $rootScope.$on("$routeChangeSuccess", function(e, next) {
        console.log('route changed', next.$$route.originalPath);
        $rootScope.route = next.$$route.originalPath.split('/')[1];
      });

      // various stages of loading
      $rootScope.$on('Phased:setup', function(){
        $rootScope.phasedSetup = true;
      });
      $rootScope.$on('Phased:meta', function(){
        $rootScope.phasedMeta = true;
      });
      $rootScope.$on('Phased:teamComplete', function(){
        $rootScope.phasedTeamComplete = true;
      });
      $rootScope.$on('Phased:membersComplete', function(){
        $rootScope.phasedMembersComplete = true;
      });
      $rootScope.$on('Phased:projectsComplete', function(){
        $rootScope.phasedProjectsComplete = true;
      });
      $rootScope.$on('Phased:statusesComplete', function(){
        $rootScope.phasedStatusesComplete = true;
      });

  }])

  .config(function ($routeProvider, $locationProvider) {
    $routeProvider
      .otherwise({
        redirectTo: '/'
      });

    $locationProvider.html5Mode(true);
  });
