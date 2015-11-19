'use strict';

describe('Controller: AddcategoryCtrl', function () {

  // load the controller's module
  beforeEach(module('webappApp'));

  var AddcategoryCtrl, scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    AddcategoryCtrl = $controller('AddcategoryCtrl', {
      $scope: scope
    });
  }));

  it('should ...', function () {
    expect(1).toEqual(1);
  });
});
