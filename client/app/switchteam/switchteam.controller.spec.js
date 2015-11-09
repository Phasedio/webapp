'use strict';

describe('Controller: SwitchteamCtrl', function () {

  // load the controller's module
  beforeEach(module('webappApp'));

  var SwitchteamCtrl, scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    SwitchteamCtrl = $controller('SwitchteamCtrl', {
      $scope: scope
    });
  }));

  it('should ...', function () {
    expect(1).toEqual(1);
  });
});
