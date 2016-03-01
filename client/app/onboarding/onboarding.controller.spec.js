'use strict';

describe('Controller: OnboardingCtrl', function () {

  // load the controller's module
  beforeEach(module('webappApp'));

  var OnboardingCtrl, scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    OnboardingCtrl = $controller('OnboardingCtrl', {
      $scope: scope
    });
  }));

  it('should ...', function () {
  });
});
