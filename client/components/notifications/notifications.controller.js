'use strict';
angular.module('webappApp')
  .controller('NotifCtrl', function ($scope, $location, Notif) {
		$scope.notifStream = Notif.stream;
		$scope.showNotifs = true; // show notif pane while in dev
		console.dir(Notif.stream);
  })