'use strict';

angular.module('webappApp')
  .config(function ($routeProvider) {
    $routeProvider
      .when('/team', {
        templateUrl: 'app/main/main.html',
        controller: 'MainCtrl',
        resolve: {
                    // controller will not be loaded until $requireAuth resolves
                    // Auth refers to our $firebaseAuth wrapper in the example above
                    "currentAuth": ["Auth", function(Auth) {
                      // $requireAuth returns a promise so the resolve waits for it to complete
                      // If the promise is rejected, it will throw a $stateChangeError (see above)
                      return Auth.fb.$requireAuth();
                    }]
                  }
      });
  });
