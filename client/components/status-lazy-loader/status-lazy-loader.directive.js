angular.module('webappApp')
	.directive('statusLazyLoader', ['Phased', '$window', function(Phased, $window) {
		return {
			restrict: 'A',
			replace: true,
			templateUrl: 'components/status-lazy-loader/status-lazy-loader.template.html',
			link: function($scope, $el, $attrs) {
				$scope.loadMore = Phased.getStatusesPage;

				// simple scroll-to-top fn
				// shouldn't need this (should just use href="#"),
				// but angular is interrupting local anchors
				$scope.goToTop = function(e) {
					e.preventDefault();
					$window.scrollTo(0, 0);
				}
			}
		}
	}])