'use strict';

describe('Controller: TeamExpiredCtrl', function () {

  // load the controller's module
  beforeEach(module('webappApp'));

  var TeamExpiredCtrl, scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    TeamExpiredCtrl = $controller('TeamExpiredCtrl', {
      $scope: scope
    });
  }));

  it('should ...', function () {
  });
});
