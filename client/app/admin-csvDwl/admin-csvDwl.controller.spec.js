'use strict';

describe('Controller: AdminCsvDwlCtrl', function () {

  // load the controller's module
  beforeEach(module('webappApp'));

  var AdminCsvDwlCtrl, scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    AdminCsvDwlCtrl = $controller('AdminCsvDwlCtrl', {
      $scope: scope
    });
  }));

  it('should ...', function () {
    expect(1).toEqual(1);
  });
});
