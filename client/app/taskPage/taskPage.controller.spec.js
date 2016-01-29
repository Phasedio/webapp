'use strict';

describe('Controller: TaskPageCtrl', function () {

  // load the controller's module
  beforeEach(module('webappApp'));

  var TaskPageCtrl, scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    TaskPageCtrl = $controller('TaskPageCtrl', {
      $scope: scope
    });
  }));

  it('should ...', function () {
    expect(1).toEqual(1);
  });
});
