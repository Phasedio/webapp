'use strict';

describe('Controller: EditcategoryCtrl', function () {

  // load the controller's module
  beforeEach(module('webappApp'));

  var EditcategoryCtrl, scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    EditcategoryCtrl = $controller('EditcategoryCtrl', {
      $scope: scope
    });
  }));

  it('should ...', function () {
    expect(1).toEqual(1);
  });
});
