'use strict';

describe('Controller: UpgradeCtrl', function () {

  // load the controller's module
  beforeEach(module('webappApp'));

  var UpgradeCtrl, scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    UpgradeCtrl = $controller('UpgradeCtrl', {
      $scope: scope
    });
  }));

  it('should ...', function () {
  });
});
