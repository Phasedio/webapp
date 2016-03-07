'use strict';

describe('Controller: BillingCtrl', function () {

  // load the controller's module
  beforeEach(module('webappApp'));

  var BillingCtrl, scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    BillingCtrl = $controller('BillingCtrl', {
      $scope: scope
    });
  }));

  it('should ...', function () {
    expect(1).toEqual(1);
  });
});
