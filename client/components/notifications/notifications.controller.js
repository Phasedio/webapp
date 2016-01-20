'use strict';
angular.module('webappApp')
  .controller('NotifCtrl', function ($scope, $location, Notif) {
		$scope.notifStream = Notif.stream;
		$scope.showNotifs = true; // show notif pane while in dev

		// marks all notifications as read after a delay
		// only if the notification panel is open
		var markAllReadAfter = function(delay) {
			window.setTimeout(function() {
				if ($scope.showNotifs) {
					Notif.markAllRead();
					console.log('all read');
				}
			}, delay);
		}

		// toggle notification panel
		// and mark all as read if open for over markReadDelay ms
		$scope.togglePane = function() {
			var markReadDelay = 500; // ms
			$scope.showNotifs = !$scope.showNotifs;
			if ($scope.showNotifs) {
				markAllReadAfter(markReadDelay);
			}
		}

		// tells if a notification is read or not
		$scope.isRead = function(key) {
			return Notif.read.indexOf(key) >= 0 ? true : false;
		}

		// on page load, if notification panel is open
		// mark all read after 5 sec
		var unsetAssignments = $scope.$on('Phased:assignments:data', function(){
			if ($scope.showNotifs) {
				markAllReadAfter(5000);
			}
			unsetAssignments();
		});
		var unsetHistory = $scope.$on('Phased:history', function(){
			if ($scope.showNotifs) {
				markAllReadAfter(5000);
			}
			unsetHistory();
		});
  });