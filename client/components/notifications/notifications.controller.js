'use strict';
angular.module('webappApp')
  .controller('NotifCtrl', function ($scope, $location, Phased) {
		$scope.notifications = Phased.notif;
		$scope.showNotifs = true; // show notif pane while in dev

		// marks all notifications as read after a delay
		// only if the notification panel is open
		var markAllReadAfter = function(delay) {
			window.setTimeout(function() {
				if ($scope.showNotifs) {
					Phased.markAllNotifsAsRead();
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

		// tells whether there are any unread notifications at all
		$scope.hasUnread = function() {
			for (var i in Phased.notif.stream) {
				if (!Phased.notif.stream[i].read) {
					return true;
				}
			}
			return false;
		}

		// new data, if notification panel is open
		// mark all read after 5 sec
		$scope.$on('Phased:notification', function(){
			if ($scope.showNotifs) {
				markAllReadAfter(5000);
			}
		});
  });