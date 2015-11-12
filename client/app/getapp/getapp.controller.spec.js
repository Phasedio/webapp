'use strict';

describe('Controller: GetappCtrl', function () {

  // load the controller's module
  beforeEach(module('webappApp'));

  var GetappCtrl, scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    GetappCtrl = $controller('GetappCtrl', {
      $scope: scope
    });
  }));

  it('should ...', function () {
    expect(1).toEqual(1);
  });
});
