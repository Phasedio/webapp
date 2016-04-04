'use strict';

describe('Service: Auth', function AuthSpec() {

  // load the service's module
  beforeEach(module('webappApp'));

  // instantiate service
  var Auth;
  beforeEach(inject(function (_Auth_) {
    Auth = _Auth_;
  }));

  it('should do something', function () {
    expect(!!Auth).toBe(true);
  });

});
